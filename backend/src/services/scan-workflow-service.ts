import path from "node:path"

import {
  analyzeSourceFiles,
  detectLanguage,
  type AnalysisIssue,
  type AnalysisSeverity,
  type SourceFileInput,
  type StaticAnalysisResult,
} from "./static-analysis-service"

export type ScanStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type ScanStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type ScanStep = {
  id: string
  label: string
  status: ScanStepStatus
}

export type ScanLog = {
  id: string
  timestamp: string
  level: "info" | "success" | "warning" | "error"
  message: string
}

export type ScanJob = {
  id: string
  repositoryName: string
  repositoryUrl?: string
  status: ScanStatus
  progress: number
  currentStep: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  cancelledAt: string | null
  requestedLanguage: string
  languageSummary: Record<string, number>
  filesTotal: number
  filesAnalyzed: number
  issuesTotal: number
  severityCounts: Record<AnalysisSeverity, number>
  analyzerSummary: string[]
  sourceFiles: SourceFileInput[]
  steps: ScanStep[]
  logs: ScanLog[]
  result: StaticAnalysisResult | null
  error: string | null
  cancelRequested: boolean
}

export type ScanInput = {
  repositoryName: string
  repositoryUrl?: string
  requestedLanguage?: string
  files: SourceFileInput[]
}

const scanJobs = new Map<string, ScanJob>()
const jobRetentionMs = 1000 * 60 * 60 * 6
const maxStoredJobs = 50
let cachedJobList: ReturnType<typeof serializeJob>[] | null = null

const supportedExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
])

const ignoredPathSegments = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
])

function makeScanId() {
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function makeLogId() {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function now() {
  return new Date().toISOString()
}

function normalizeSourcePath(filePath: string) {
  return filePath.replaceAll("\\", "/").replace(/^\/+/, "")
}

function shouldAnalyzeFile(filePath: string) {
  const normalized = normalizeSourcePath(filePath)
  const segments = normalized.split("/")

  if (segments.some((segment) => ignoredPathSegments.has(segment))) {
    return false
  }

  return supportedExtensions.has(path.extname(normalized).toLowerCase())
}

function createSteps(): ScanStep[] {
  return [
    { id: "queue", label: "Queue scan", status: "pending" },
    { id: "parse", label: "Parse files", status: "pending" },
    { id: "detect", label: "Detect languages", status: "pending" },
    { id: "analyze", label: "Run analyzers", status: "pending" },
    { id: "summarize", label: "Build results", status: "pending" },
  ]
}

function serializeJob(
  job: ScanJob,
  options: { includeSourceFiles?: boolean } = {}
) {
  return {
    id: job.id,
    repositoryName: job.repositoryName,
    repositoryUrl: job.repositoryUrl,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
    requestedLanguage: job.requestedLanguage,
    languageSummary: job.languageSummary,
    filesTotal: job.filesTotal,
    filesAnalyzed: job.filesAnalyzed,
    issuesTotal: job.issuesTotal,
    severityCounts: job.severityCounts,
    analyzerSummary: job.analyzerSummary,
    sourceFiles: options.includeSourceFiles
      ? job.sourceFiles
      : job.sourceFiles.map((file) => ({
          path: file.path,
          content: "",
        })),
    steps: job.steps,
    logs: job.logs,
    result: job.result,
    error: job.error,
  }
}

function invalidateJobListCache() {
  cachedJobList = null
}

function pruneOldJobs() {
  const cutoff = Date.now() - jobRetentionMs
  const orderedJobs = Array.from(scanJobs.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )

  for (const job of orderedJobs) {
    const isTerminal = ["completed", "failed", "cancelled"].includes(job.status)
    if (isTerminal && Date.parse(job.updatedAt) < cutoff) {
      scanJobs.delete(job.id)
    }
  }

  for (const job of orderedJobs.slice(maxStoredJobs)) {
    const isTerminal = ["completed", "failed", "cancelled"].includes(job.status)
    if (isTerminal) {
      scanJobs.delete(job.id)
    }
  }
}

function addLog(job: ScanJob, level: ScanLog["level"], message: string) {
  job.logs.push({
    id: makeLogId(),
    timestamp: now(),
    level,
    message,
  })
  job.updatedAt = now()
  invalidateJobListCache()
}

function setStep(
  job: ScanJob,
  stepId: string,
  status: ScanStepStatus,
  progress: number
) {
  job.steps = job.steps.map((step) =>
    step.id === stepId
      ? { ...step, status }
      : step.status === "running"
        ? { ...step, status: "completed" }
        : step
  )
  job.currentStep = stepId
  job.progress = Math.max(job.progress, progress)
  job.updatedAt = now()
  invalidateJobListCache()
}

function assertNotCancelled(job: ScanJob) {
  if (!job.cancelRequested) return

  job.status = "cancelled"
  job.currentStep = "cancelled"
  job.cancelledAt = now()
  job.updatedAt = now()
  job.steps = job.steps.map((step) =>
    step.status === "pending" || step.status === "running"
      ? { ...step, status: "cancelled" }
      : step
  )
  addLog(job, "warning", "Scan cancelled before the next workflow step.")

  throw new Error("SCAN_CANCELLED")
}

function summarizeLanguages(files: SourceFileInput[]) {
  return files.reduce<Record<string, number>>((summary, file) => {
    const language = detectLanguage(file.path)
    summary[language] = (summary[language] ?? 0) + 1
    return summary
  }, {})
}

function issuePreview(issues: AnalysisIssue[]) {
  return issues.slice(0, 3).map((issue) => {
    const location = issue.lineNumber
      ? `${issue.filePath}:${issue.lineNumber}`
      : issue.filePath
    return `${issue.severity.toUpperCase()} ${location} - ${issue.message}`
  })
}

async function runScan(job: ScanJob, inputFiles: SourceFileInput[]) {
  try {
    job.status = "running"
    setStep(job, "queue", "running", 8)
    addLog(job, "info", "Scan job picked up by the in-memory queue.")
    await new Promise((resolve) => setTimeout(resolve, 250))
    assertNotCancelled(job)

    setStep(job, "parse", "running", 22)
    const normalizedFiles = inputFiles
      .map((file) => ({
        path: normalizeSourcePath(file.path),
        content: file.content,
      }))
      .filter((file) => shouldAnalyzeFile(file.path))

    job.filesTotal = inputFiles.length
    job.filesAnalyzed = normalizedFiles.length
    job.sourceFiles = normalizedFiles
    addLog(
      job,
      "info",
      `Parsed ${inputFiles.length} files and selected ${normalizedFiles.length} supported source files.`
    )
    await new Promise((resolve) => setTimeout(resolve, 250))
    assertNotCancelled(job)

    if (normalizedFiles.length === 0) {
      throw new Error(
        "No supported JavaScript, TypeScript, or Python files were found."
      )
    }

    setStep(job, "detect", "running", 38)
    job.languageSummary = summarizeLanguages(normalizedFiles)
    addLog(
      job,
      "success",
      `Detected languages: ${Object.entries(job.languageSummary)
        .map(([language, count]) => `${language} (${count})`)
        .join(", ")}.`
    )
    await new Promise((resolve) => setTimeout(resolve, 250))
    assertNotCancelled(job)

    setStep(job, "analyze", "running", 72)
    addLog(
      job,
      "info",
      "Running ESLint, Pylint, and Bandit where matching files are available."
    )
    const result = await analyzeSourceFiles(normalizedFiles)
    assertNotCancelled(job)

    setStep(job, "summarize", "running", 92)
    job.result = result
    job.issuesTotal = result.summary.totalIssues
    job.severityCounts = result.summary.severityCounts
    job.analyzerSummary = result.summary.analyzers
    for (const preview of issuePreview(result.issues)) {
      addLog(job, "warning", preview)
    }

    job.steps = job.steps.map((step) => ({ ...step, status: "completed" }))
    job.status = "completed"
    job.currentStep = "completed"
    job.progress = 100
    job.completedAt = now()
    job.updatedAt = now()
    addLog(
      job,
      "success",
      `Scan completed with ${result.summary.totalIssues} issues across ${result.summary.totalFiles} files.`
    )
  } catch (error) {
    if (error instanceof Error && error.message === "SCAN_CANCELLED") {
      return
    }

    job.status = "failed"
    job.currentStep = "failed"
    job.progress = Math.max(job.progress, 100)
    job.error = error instanceof Error ? error.message : "Scan failed"
    job.updatedAt = now()
    job.steps = job.steps.map((step) =>
      step.status === "running" ? { ...step, status: "failed" } : step
    )
    addLog(job, "error", job.error)
  }
}

export function createScanJob(input: ScanInput) {
  const createdAt = now()
  const job: ScanJob = {
    id: makeScanId(),
    repositoryName: input.repositoryName,
    repositoryUrl: input.repositoryUrl,
    status: "queued",
    progress: 0,
    currentStep: "queue",
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    cancelledAt: null,
    requestedLanguage: input.requestedLanguage ?? "auto",
    languageSummary: {},
    filesTotal: input.files.length,
    filesAnalyzed: 0,
    issuesTotal: 0,
    severityCounts: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
    analyzerSummary: [],
    sourceFiles: [],
    steps: createSteps(),
    logs: [],
    result: null,
    error: null,
    cancelRequested: false,
  }

  addLog(job, "info", `Queued scan for ${input.repositoryName}.`)
  scanJobs.set(job.id, job)
  pruneOldJobs()
  invalidateJobListCache()
  void runScan(job, input.files)

  return serializeJob(job, { includeSourceFiles: true })
}

export function getScanJob(scanId: string) {
  const job = scanJobs.get(scanId)
  return job ? serializeJob(job, { includeSourceFiles: true }) : null
}

export function cancelScanJob(scanId: string) {
  const job = scanJobs.get(scanId)
  if (!job) return null

  if (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return serializeJob(job, { includeSourceFiles: true })
  }

  job.cancelRequested = true
  job.status = "cancelled"
  job.currentStep = "cancelled"
  job.cancelledAt = now()
  job.updatedAt = now()
  job.steps = job.steps.map((step) =>
    step.status === "pending" || step.status === "running"
      ? { ...step, status: "cancelled" }
      : step
  )
  addLog(job, "warning", "Cancellation requested by the user.")

  invalidateJobListCache()

  return serializeJob(job, { includeSourceFiles: true })
}

export function listScanJobs() {
  if (cachedJobList) return cachedJobList

  pruneOldJobs()
  cachedJobList = Array.from(scanJobs.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((job) => serializeJob(job))
  return cachedJobList
}
