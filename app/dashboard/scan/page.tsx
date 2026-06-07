"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileCode2,
  GitBranch,
  KeyRound,
  Loader2,
  Lock,
  Play,
  ShieldCheck,
  Square,
  Star,
  Terminal,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type ScanStatus =
  | "idle"
  | "validating"
  | "valid"
  | "collecting"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "invalid"

type RepositoryInfo = {
  id: number
  name: string
  owner: string
  url: string
  defaultBranch: string
  language: string | null
  isPrivate: boolean
  stars: number
  openIssues: number
  updatedAt: string
}

type ScanStep = {
  id: string
  label: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
}

type ScanLog = {
  id: string
  timestamp: string
  level: "info" | "success" | "warning" | "error"
  message: string
}

type ScanJob = {
  id: string
  repositoryName: string
  status: Exclude<ScanStatus, "idle" | "validating" | "valid" | "collecting" | "invalid">
  progress: number
  currentStep: string
  languageSummary: Record<string, number>
  filesTotal: number
  filesAnalyzed: number
  issuesTotal: number
  severityCounts: Record<"low" | "medium" | "high" | "critical", number>
  analyzerSummary: string[]
  steps: ScanStep[]
  logs: ScanLog[]
  error: string | null
}

type ApiResponse<T> = {
  success: boolean
  data: T
}

type RepositoryScanResponse = {
  repository: RepositoryInfo
  scan: ScanJob
  filesCollected: number
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"
const storageKey = "bughunter.repositories"

const languages = [
  { value: "auto", label: "Auto-detect" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
]

function parseGitHubUrl(url: string) {
  const match = url.trim().match(/^https?:\/\/github\.com\/([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/i)

  if (!match) return null

  return {
    owner: match[1],
    repo: match[2],
  }
}

function saveRepository(repository: RepositoryInfo) {
  const existing = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as RepositoryInfo[]
  const next = [
    repository,
    ...existing.filter((item) => item.id !== repository.id && item.url !== repository.url),
  ].slice(0, 12)

  localStorage.setItem(storageKey, JSON.stringify(next))
}

function stepIcon(step: ScanStep) {
  if (step.status === "completed") return <CheckCircle2 className="h-4 w-4 text-success" />
  if (step.status === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />
  if (step.status === "failed") return <AlertCircle className="h-4 w-4 text-destructive" />
  if (step.status === "cancelled") return <Square className="h-4 w-4 text-muted-foreground" />
  return <Circle className="h-4 w-4 text-muted-foreground" />
}

export default function ScanRepositoryPage() {
  const [repoUrl, setRepoUrl] = React.useState("")
  const [token, setToken] = React.useState("")
  const [language, setLanguage] = React.useState("auto")
  const [status, setStatus] = React.useState<ScanStatus>("idle")
  const [repoInfo, setRepoInfo] = React.useState<RepositoryInfo | null>(null)
  const [scanJob, setScanJob] = React.useState<ScanJob | null>(null)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [collectionMessage, setCollectionMessage] = React.useState("")

  const pollScan = React.useCallback(async (scanId: string) => {
    const response = await fetch(`${apiBaseUrl}/scans/${scanId}`)
    if (!response.ok) {
      throw new Error("Unable to refresh scan status.")
    }

    const payload = (await response.json()) as ApiResponse<ScanJob>
    setScanJob(payload.data)
    setStatus(payload.data.status)

    return payload.data
  }, [])

  React.useEffect(() => {
    if (!scanJob || !["queued", "running"].includes(scanJob.status)) return

    const interval = window.setInterval(() => {
      void pollScan(scanJob.id).catch((error) => {
        setStatus("failed")
        setErrorMessage(error instanceof Error ? error.message : "Unable to poll scan status.")
      })
    }, 900)

    return () => window.clearInterval(interval)
  }, [pollScan, scanJob])

  React.useEffect(() => {
    if (scanJob?.status === "completed") {
      toast.success("Scan completed", {
        description: `${scanJob.issuesTotal} issues found in ${scanJob.filesAnalyzed} files.`,
      })
    }

    if (scanJob?.status === "failed") {
      toast.error("Scan failed", {
        description: scanJob.error ?? "The scan workflow could not complete.",
      })
    }
  }, [scanJob?.error, scanJob?.filesAnalyzed, scanJob?.id, scanJob?.issuesTotal, scanJob?.status])

  const validateRepository = React.useCallback(async () => {
    const parsed = parseGitHubUrl(repoUrl)

    setRepoInfo(null)
    setScanJob(null)
    setErrorMessage("")
    setCollectionMessage("")

    if (!repoUrl.trim()) {
      setStatus("idle")
      return
    }

    if (!parsed) {
      setStatus("invalid")
      setErrorMessage("Use a GitHub URL like https://github.com/owner/repository")
      return
    }

    setStatus("validating")

    try {
      const response = await fetch(`${apiBaseUrl}/repositories/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: repoUrl, token }),
      })
      const payload = (await response.json()) as ApiResponse<RepositoryInfo>

      if (!response.ok || !payload.success) {
        throw new Error("GitHub could not validate this repository.")
      }

      const repository = payload.data

      setRepoInfo(repository)
      setLanguage(repository.language ? repository.language.toLowerCase() : "auto")
      setStatus("valid")
      saveRepository(repository)
      toast.success("Repository validated", {
        description: `${repository.owner}/${repository.name} is ready for scanning.`,
      })
    } catch (error) {
      setStatus("invalid")
      setErrorMessage(error instanceof Error ? error.message : "Unable to validate repository")
    }
  }, [repoUrl, token])

  const startScan = async () => {
    if (!repoInfo) return

    setStatus("collecting")
    setScanJob(null)
    setErrorMessage("")

    try {
      setCollectionMessage("Reading repository tree and creating scan job...")

      const response = await fetch(`${apiBaseUrl}/repositories/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: repoInfo.url,
          token,
          requestedLanguage: language,
        }),
      })

      if (!response.ok) {
        throw new Error("Backend scanner could not start the job.")
      }

      const payload = (await response.json()) as ApiResponse<RepositoryScanResponse>
      setScanJob(payload.data.scan)
      setStatus(payload.data.scan.status)
      setCollectionMessage("")
      toast.success("Scan started", {
        description: `${payload.data.filesCollected} files sent to the scanner queue.`,
      })
    } catch (error) {
      setStatus("failed")
      setErrorMessage(error instanceof Error ? error.message : "Unable to start scan.")
    }
  }

  const cancelScan = async () => {
    if (!scanJob) return

    try {
      const response = await fetch(`${apiBaseUrl}/scans/${scanJob.id}/cancel`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Unable to cancel this scan.")
      }

      const payload = (await response.json()) as ApiResponse<ScanJob>
      setScanJob(payload.data)
      setStatus(payload.data.status)
      toast.message("Scan cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel scan.")
    }
  }

  const canStartScan = status === "valid" && Boolean(repoInfo)
  const isBusy = ["validating", "collecting", "queued", "running"].includes(status)
  const progressValue = scanJob?.progress ?? (status === "collecting" ? 12 : 0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-5xl space-y-8"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Scan</h1>
        <p className="text-muted-foreground">
          Validate a GitHub repository, collect source files, and run the scanner workflow.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch className="h-5 w-5" />
              Repository
            </CardTitle>
            <CardDescription>
              Public repositories scan directly. Private repositories need a GitHub personal access token.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Input
                    id="repo-url"
                    placeholder="https://github.com/username/repository"
                    value={repoUrl}
                    disabled={isBusy}
                    onChange={(event) => {
                      setRepoUrl(event.target.value)
                      setStatus(event.target.value ? "idle" : "idle")
                      setRepoInfo(null)
                      setScanJob(null)
                      setErrorMessage("")
                      setCollectionMessage("")
                    }}
                    className={cn(
                      "pr-10 transition-all duration-200",
                      status === "valid" && "border-success focus-visible:ring-success",
                      status === "invalid" && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {status === "validating" && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {status === "valid" && <CheckCircle2 className="h-4 w-4 text-success" />}
                    {(status === "invalid" || status === "failed") && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={validateRepository}
                  disabled={!repoUrl.trim() || isBusy}
                >
                  {status === "validating" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Validate
                </Button>
              </div>
              {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="github-token">Private repository token</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="github-token"
                  type="password"
                  value={token}
                  disabled={isBusy}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Optional GitHub fine-grained token"
                  className="pl-9"
                />
              </div>
            </div>

            <AnimatePresence>
              {repoInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg border bg-muted/50 p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-background">
                        {repoInfo.isPrivate ? <Lock className="h-5 w-5" /> : <GitBranch className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium">
                          {repoInfo.owner}/{repoInfo.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Default branch: {repoInfo.defaultBranch}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{repoInfo.language ?? "Unknown"}</Badge>
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3" />
                        {repoInfo.stars}
                      </Badge>
                      <Badge variant={repoInfo.isPrivate ? "destructive" : "outline"}>
                        {repoInfo.isPrivate ? "Private" : "Public"}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <Label>Programming Language</Label>
              <Select value={language} onValueChange={setLanguage} disabled={isBusy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {scanJob ? scanJob.status : status === "collecting" ? "collecting" : "ready"}
                </span>
                <span className="text-muted-foreground">{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
              <p className="min-h-5 text-sm text-muted-foreground">
                {collectionMessage || scanJob?.logs.at(-1)?.message || "Waiting for a repository."}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="flex-1" disabled={!canStartScan} onClick={startScan}>
                <Play className="mr-2 h-4 w-4" />
                Start Scan
              </Button>
              {["queued", "running"].includes(scanJob?.status ?? "") && (
                <Button variant="outline" onClick={cancelScan}>
                  <Square className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
              {repoInfo && (
                <Button variant="outline" asChild>
                  <a href={repoInfo.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open GitHub
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileCode2 className="h-5 w-5" />
                Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(scanJob?.steps ?? [
                { id: "queue", label: "Queue scan", status: "pending" },
                { id: "parse", label: "Parse files", status: "pending" },
                { id: "detect", label: "Detect languages", status: "pending" },
                { id: "analyze", label: "Run analyzers", status: "pending" },
                { id: "summarize", label: "Build results", status: "pending" },
              ] satisfies ScanStep[]).map((step) => (
                <div key={step.id} className="flex items-center gap-3 text-sm">
                  {stepIcon(step)}
                  <span className={cn(step.status === "pending" && "text-muted-foreground")}>
                    {step.label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Files</p>
                <p className="text-xl font-semibold">{scanJob?.filesAnalyzed ?? 0}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Issues</p>
                <p className="text-xl font-semibold">{scanJob?.issuesTotal ?? 0}</p>
              </div>
              {(["critical", "high", "medium", "low"] as const).map((severity) => (
                <div key={severity} className="rounded-md border p-3">
                  <p className="capitalize text-muted-foreground">{severity}</p>
                  <p className="text-xl font-semibold">
                    {scanJob?.severityCounts[severity] ?? 0}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="h-5 w-5" />
            Live Scan Terminal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 rounded-md border bg-zinc-950 p-4">
            <div className="space-y-2 font-mono text-xs text-zinc-100">
              {(scanJob?.logs.length ? scanJob.logs : [
                {
                  id: "empty",
                  timestamp: new Date().toISOString(),
                  level: "info",
                  message: "Scanner idle.",
                },
              ] satisfies ScanLog[]).map((log) => (
                <div key={log.id} className="flex gap-3">
                  <span className="shrink-0 text-zinc-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 uppercase",
                      log.level === "success" && "text-emerald-400",
                      log.level === "warning" && "text-amber-300",
                      log.level === "error" && "text-red-400",
                      log.level === "info" && "text-sky-300"
                    )}
                  >
                    {log.level}
                  </span>
                  <span className="min-w-0 break-words">{log.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  )
}
