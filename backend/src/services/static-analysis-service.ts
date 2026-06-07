import { execFile } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { ESLint } from "eslint"

import { AppError } from "../middleware/error-handler"

const execFileAsync = promisify(execFile)

export type AnalysisSeverity = "low" | "medium" | "high" | "critical"

export type AnalysisIssue = {
  id: string
  analyzer: "eslint" | "pylint" | "bandit" | "dependency"
  filePath: string
  lineNumber: number | null
  column: number | null
  endLineNumber?: number | null
  endColumn?: number | null
  ruleId: string | null
  severity: AnalysisSeverity
  category: string
  message: string
  source?: string
}

export type FileAnalysisSummary = {
  filePath: string
  language: string
  issueCount: number
  severityCounts: Record<AnalysisSeverity, number>
}

export type StaticAnalysisResult = {
  issues: AnalysisIssue[]
  files: FileAnalysisSummary[]
  summary: {
    totalFiles: number
    totalIssues: number
    severityCounts: Record<AnalysisSeverity, number>
    analyzers: string[]
  }
}

export type SourceFileInput = {
  path: string
  content: string
}

type PylintMessage = {
  type?: string
  module?: string
  obj?: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
  path?: string
  symbol?: string
  message?: string
  "message-id"?: string
}

type BanditResult = {
  filename?: string
  line_number?: number
  issue_severity?: string
  issue_confidence?: string
  test_id?: string
  test_name?: string
  issue_text?: string
  code?: string
}

const emptySeverityCounts = (): Record<AnalysisSeverity, number> => ({
  low: 0,
  medium: 0,
  high: 0,
  critical: 0,
})

const languageByExtension: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
}

export function detectLanguage(filePath: string) {
  return languageByExtension[path.extname(filePath).toLowerCase()] ?? "unknown"
}

function normalizePath(filePath: string) {
  return filePath.replaceAll("\\", "/").replace(/^\/+/, "")
}

function severityFromEslint(severity: number): AnalysisSeverity {
  return severity === 2 ? "high" : "medium"
}

function severityFromPylint(type?: string): AnalysisSeverity {
  switch (type) {
    case "fatal":
    case "error":
      return "high"
    case "warning":
      return "medium"
    case "refactor":
    case "convention":
    case "information":
    default:
      return "low"
  }
}

function severityFromBandit(severity?: string): AnalysisSeverity {
  switch (severity?.toUpperCase()) {
    case "HIGH":
      return "critical"
    case "MEDIUM":
      return "high"
    case "LOW":
    default:
      return "medium"
  }
}

function categoryFromEslint(ruleId: string | null) {
  if (!ruleId) return "Syntax"
  if (ruleId.includes("security")) return "Security"
  if (ruleId.includes("react-hooks")) return "Bug"
  if (ruleId.includes("no-unused") || ruleId.includes("consistent"))
    return "Code Quality"
  return "JavaScript"
}

function makeIssueId(parts: Array<string | number | null | undefined>) {
  return parts.filter((part) => part !== null && part !== undefined).join(":")
}

function buildResult(
  files: SourceFileInput[],
  issues: AnalysisIssue[]
): StaticAnalysisResult {
  const summaryCounts = emptySeverityCounts()
  const analyzers = new Set<string>()

  for (const issue of issues) {
    summaryCounts[issue.severity] += 1
    analyzers.add(issue.analyzer)
  }

  const fileSummaries = files.map((file) => {
    const filePath = normalizePath(file.path)
    const fileIssues = issues.filter(
      (issue) => normalizePath(issue.filePath) === filePath
    )
    const severityCounts = emptySeverityCounts()

    for (const issue of fileIssues) {
      severityCounts[issue.severity] += 1
    }

    return {
      filePath,
      language: detectLanguage(filePath),
      issueCount: fileIssues.length,
      severityCounts,
    }
  })

  return {
    issues,
    files: fileSummaries,
    summary: {
      totalFiles: files.length,
      totalIssues: issues.length,
      severityCounts: summaryCounts,
      analyzers: Array.from(analyzers),
    },
  }
}

export async function analyzeJavaScriptFiles(files: SourceFileInput[]) {
  const supportedFiles = files.filter((file) =>
    ["javascript", "typescript"].includes(detectLanguage(file.path))
  )

  const eslint = new ESLint({
    cwd: process.cwd(),
    errorOnUnmatchedPattern: false,
  })

  const issues: AnalysisIssue[] = []

  for (const file of supportedFiles) {
    const filePath = normalizePath(file.path)
    const results = await eslint.lintText(file.content, { filePath })

    for (const result of results) {
      for (const message of result.messages) {
        const severity = severityFromEslint(message.severity)

        issues.push({
          id: makeIssueId([
            "eslint",
            filePath,
            message.line,
            message.column,
            message.ruleId,
          ]),
          analyzer: "eslint",
          filePath,
          lineNumber: message.line ?? null,
          column: message.column ?? null,
          endLineNumber: message.endLine ?? null,
          endColumn: message.endColumn ?? null,
          ruleId: message.ruleId ?? null,
          severity,
          category: categoryFromEslint(message.ruleId ?? null),
          message: message.message,
        })
      }
    }
  }

  return buildResult(supportedFiles, issues)
}

export function parsePylintJson(output: string): AnalysisIssue[] {
  const messages = JSON.parse(output || "[]") as PylintMessage[]

  return messages.map((message, index) => {
    const filePath = normalizePath(
      message.path ?? message.module ?? "unknown.py"
    )

    return {
      id: makeIssueId([
        "pylint",
        filePath,
        message.line,
        message.column,
        message.symbol,
        index,
      ]),
      analyzer: "pylint",
      filePath,
      lineNumber: message.line ?? null,
      column: message.column ?? null,
      endLineNumber: message.endLine ?? null,
      endColumn: message.endColumn ?? null,
      ruleId: message.symbol ?? message["message-id"] ?? null,
      severity: severityFromPylint(message.type),
      category: message.type ? `Python ${message.type}` : "Python",
      message: message.message ?? "Pylint issue detected",
    }
  })
}

export function parseBanditJson(output: string): AnalysisIssue[] {
  const payload = JSON.parse(output || "{}") as { results?: BanditResult[] }

  return (payload.results ?? []).map((result, index) => {
    const filePath = normalizePath(result.filename ?? "unknown.py")

    return {
      id: makeIssueId([
        "bandit",
        filePath,
        result.line_number,
        result.test_id,
        index,
      ]),
      analyzer: "bandit",
      filePath,
      lineNumber: result.line_number ?? null,
      column: null,
      ruleId: result.test_id ?? result.test_name ?? null,
      severity: severityFromBandit(result.issue_severity),
      category: "Security",
      message: result.issue_text ?? "Bandit security issue detected",
      source: result.code,
    }
  })
}

async function writeTempFiles(files: SourceFileInput[]) {
  const root = await mkdtemp(path.join(tmpdir(), "bughunter-analysis-"))

  for (const file of files) {
    const targetPath = path.resolve(root, normalizePath(file.path))
    const relativePath = path.relative(root, targetPath)
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new AppError(
        "Invalid file path in analysis payload",
        400,
        "INVALID_FILE_PATH"
      )
    }

    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, file.content, "utf8")
  }

  return root
}

function relativeTempPath(tempRoot: string, filePath: string) {
  const normalized = normalizePath(filePath)
  const absolutePath = path.isAbsolute(normalized)
    ? normalized
    : path.resolve(tempRoot, normalized)
  const relativePath = path.relative(tempRoot, absolutePath)

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return normalized
  }

  return normalizePath(relativePath)
}

export async function analyzePythonFiles(files: SourceFileInput[]) {
  const pythonFiles = files.filter(
    (file) => detectLanguage(file.path) === "python"
  )
  if (pythonFiles.length === 0) {
    return buildResult([], [])
  }

  const tempRoot = await writeTempFiles(pythonFiles)

  try {
    const [pylintOutput, banditOutput] = await Promise.all([
      execFileAsync("pylint", ["--output-format=json", tempRoot], {
        maxBuffer: 1024 * 1024 * 10,
      }).catch((error) => ({ stdout: error.stdout ?? "[]" })),
      execFileAsync("bandit", ["-r", tempRoot, "-f", "json"], {
        maxBuffer: 1024 * 1024 * 10,
      }).catch((error) => ({ stdout: error.stdout ?? "{}" })),
    ])

    const issues = [
      ...parsePylintJson(pylintOutput.stdout),
      ...parseBanditJson(banditOutput.stdout),
    ].map((issue) => ({
      ...issue,
      filePath: relativeTempPath(tempRoot, issue.filePath),
    }))

    return buildResult(pythonFiles, issues)
  } finally {
    await rm(tempRoot, { force: true, recursive: true })
  }
}

export async function analyzeSourceFiles(files: SourceFileInput[]) {
  const [javascriptResult, pythonResult] = await Promise.all([
    analyzeJavaScriptFiles(files),
    analyzePythonFiles(files),
  ])

  const analysisFiles = files.filter(
    (file) => detectLanguage(file.path) !== "unknown"
  )
  const issues = [...javascriptResult.issues, ...pythonResult.issues]

  return buildResult(analysisFiles, issues)
}
