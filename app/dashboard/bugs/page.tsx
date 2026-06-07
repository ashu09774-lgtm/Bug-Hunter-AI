"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownAZ,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileCode2,
  Filter,
  Info,
  ListTree,
  Search,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Severity = "low" | "medium" | "high" | "critical"

type AnalysisIssue = {
  id: string
  analyzer: string
  filePath: string
  lineNumber: number | null
  column: number | null
  endLineNumber?: number | null
  endColumn?: number | null
  ruleId: string | null
  severity: Severity
  category: string
  message: string
  source?: string
}

type SourceFile = {
  path: string
  content: string
}

type ScanJob = {
  id: string
  repositoryName: string
  status: string
  createdAt: string
  result: {
    issues: AnalysisIssue[]
  } | null
  sourceFiles?: SourceFile[]
}

type ApiResponse<T> = {
  success: boolean
  data: T
}

type WorkspaceIssue = AnalysisIssue & {
  language: string
  title: string
  code: string
  suggestedFix: string
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"

const severityOrder: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const severityConfig = {
  critical: {
    label: "Critical",
    className: "bg-destructive/10 text-destructive border-destructive/25",
    icon: AlertCircle,
  },
  high: {
    label: "High",
    className: "bg-warning/10 text-warning border-warning/25",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    className: "bg-chart-1/10 text-chart-1 border-chart-1/25",
    icon: Info,
  },
  low: {
    label: "Low",
    className: "bg-muted text-muted-foreground border-border",
    icon: Info,
  },
} satisfies Record<
  Severity,
  { label: string; className: string; icon: React.ElementType }
>

const demoFiles: SourceFile[] = []

function detectLanguage(filePath: string) {
  if (filePath.endsWith(".ts")) return "typescript"
  if (filePath.endsWith(".tsx")) return "tsx"
  if (filePath.endsWith(".js") || filePath.endsWith(".jsx")) return "javascript"
  if (filePath.endsWith(".py")) return "python"
  return "unknown"
}

function issueTitle(issue: AnalysisIssue) {
  if (issue.ruleId) return issue.ruleId
  if (issue.category) return `${issue.category} issue`
  return "Code issue"
}

function getIssueLine(file: SourceFile | undefined, issue: AnalysisIssue) {
  if (!file || !issue.lineNumber) return issue.source ?? issue.message
  const lines = file.content.split("\n")
  return (
    lines[Math.max(issue.lineNumber - 1, 0)]?.trim() ||
    issue.source ||
    issue.message
  )
}

function buildSuggestedFix(issue: AnalysisIssue, file: SourceFile | undefined) {
  if (issue.source) return issue.source

  const currentLine = getIssueLine(file, issue)
  const message = issue.message.toLowerCase()

  if (message.includes("unused")) {
    return "// Remove the unused declaration or use it in the function."
  }

  if (
    message.includes("dependency") ||
    issue.ruleId?.includes("exhaustive-deps")
  ) {
    return currentLine.includes("[]")
      ? currentLine.replace("[]", "[userId, fetchData]")
      : "// Add the missing values to the dependency array."
  }

  if (message.includes("sql") || issue.ruleId?.toLowerCase().includes("sql")) {
    return `const query = "SELECT * FROM users WHERE email = $1"\nconst user = await db.query(query, [userEmail])`
  }

  if (message.includes("parsing")) {
    return "// Fix the syntax error on this line, then run the scan again."
  }

  return `// Review and replace the flagged line:\n${currentLine}`
}

function mapIssues(issues: AnalysisIssue[], files: SourceFile[]) {
  return issues.map((issue) => {
    const file = files.find((item) => item.path === issue.filePath)

    return {
      ...issue,
      language: detectLanguage(issue.filePath),
      title: issueTitle(issue),
      code: getIssueLine(file, issue),
      suggestedFix: buildSuggestedFix(issue, file),
    }
  })
}

function fileLineKey(issue: AnalysisIssue) {
  return `${issue.filePath}:${issue.lineNumber ?? 1}`
}

export default function BugsPage() {
  const [issues, setIssues] = React.useState<WorkspaceIssue[]>([])
  const [files, setFiles] = React.useState<SourceFile[]>([])
  const [scanName, setScanName] = React.useState("Demo workspace")
  const [selectedIssueId, setSelectedIssueId] = React.useState(
    issues[0]?.id ?? ""
  )
  const [searchQuery, setSearchQuery] = React.useState("")
  const [severityFilter, setSeverityFilter] = React.useState("all")
  const [fileFilter, setFileFilter] = React.useState("all")
  const [languageFilter, setLanguageFilter] = React.useState("all")
  const [sortMode, setSortMode] = React.useState("priority")
  const [copied, setCopied] = React.useState<"fix" | "line" | null>(null)
  const [appliedFixes, setAppliedFixes] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const loadLatestScan = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/scans`)
        if (!response.ok) return

        const payload = (await response.json()) as ApiResponse<ScanJob[]>
        const latestCompleted = payload.data.find(
          (scan) => scan.status === "completed" && scan.result?.issues.length
        )

        if (!latestCompleted?.result) return

        const detailResponse = await fetch(
          `${apiBaseUrl}/scans/${latestCompleted.id}`
        )
        const detailPayload = detailResponse.ok
          ? ((await detailResponse.json()) as ApiResponse<ScanJob>)
          : null
        const scanDetail = detailPayload?.data ?? latestCompleted
        const scanFiles = scanDetail.sourceFiles?.some(
          (sourceFile) => sourceFile.content
        )
          ? scanDetail.sourceFiles
          : demoFiles
        const mappedIssues = mapIssues(
          scanDetail.result?.issues ?? latestCompleted.result.issues,
          scanFiles
        )

        setIssues(mappedIssues)
        setFiles(scanFiles)
        setScanName(scanDetail.repositoryName)
        setSelectedIssueId(mappedIssues[0]?.id ?? "")
      } catch {
        toast.warning("Using demo bug workspace", {
          description: "Start a scan to populate this page with live issues.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    void loadLatestScan()
  }, [])

  const categories = React.useMemo(
    () => Array.from(new Set(issues.map((issue) => issue.category))).sort(),
    [issues]
  )
  const fileNames = React.useMemo(
    () => Array.from(new Set(issues.map((issue) => issue.filePath))).sort(),
    [issues]
  )
  const languages = React.useMemo(
    () => Array.from(new Set(issues.map((issue) => issue.language))).sort(),
    [issues]
  )

  const filteredIssues = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const next = issues.filter((issue) => {
      const matchesSearch =
        !query ||
        issue.title.toLowerCase().includes(query) ||
        issue.message.toLowerCase().includes(query) ||
        issue.filePath.toLowerCase().includes(query)
      const matchesSeverity =
        severityFilter === "all" || issue.severity === severityFilter
      const matchesFile = fileFilter === "all" || issue.filePath === fileFilter
      const matchesLanguage =
        languageFilter === "all" || issue.language === languageFilter
      return matchesSearch && matchesSeverity && matchesFile && matchesLanguage
    })

    return next.sort((a, b) => {
      if (sortMode === "file")
        return fileLineKey(a).localeCompare(fileLineKey(b))
      if (sortMode === "severity") return a.severity.localeCompare(b.severity)
      return (
        severityOrder[b.severity] - severityOrder[a.severity] ||
        fileLineKey(a).localeCompare(fileLineKey(b))
      )
    })
  }, [
    fileFilter,
    issues,
    languageFilter,
    searchQuery,
    severityFilter,
    sortMode,
  ])

  React.useEffect(() => {
    if (!filteredIssues.some((issue) => issue.id === selectedIssueId)) {
      setSelectedIssueId(filteredIssues[0]?.id ?? "")
    }
  }, [filteredIssues, selectedIssueId])

  const selectedIssue =
    filteredIssues.find((issue) => issue.id === selectedIssueId) ??
    filteredIssues[0]
  const selectedFile = files.find(
    (file) => file.path === selectedIssue?.filePath
  )
  const selectedLines =
    selectedFile?.content.split("\n") ?? selectedIssue?.code.split("\n") ?? []
  const selectedLine = selectedIssue?.lineNumber ?? 1
  const selectedCategoryCount = selectedIssue
    ? issues.filter((issue) => issue.category === selectedIssue.category).length
    : 0

  const copyText = async (kind: "fix" | "line", value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    toast.success(kind === "fix" ? "Fix copied" : "Line copied")
    setTimeout(() => setCopied(null), 1500)
  }

  const autoFix = (issue: WorkspaceIssue) => {
    setAppliedFixes((current) =>
      current.includes(issue.id) ? current : [...current, issue.id]
    )
    toast.success("Auto-fix staged", {
      description: `${issue.filePath}:${issue.lineNumber ?? 1} is marked for review.`,
    })
  }

  const criticalCount = issues.filter(
    (issue) => issue.severity === "critical"
  ).length
  const highCount = issues.filter((issue) => issue.severity === "high").length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bug Analysis Workspace
          </h1>
          <p className="text-muted-foreground">
            {isLoading
              ? "Loading scan results..."
              : `${filteredIssues.length} of ${issues.length} issues from ${scanName}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive border-destructive/20"
          >
            {criticalCount} Critical
          </Badge>
          <Badge
            variant="outline"
            className="bg-warning/10 text-warning border-warning/20"
          >
            {highCount} High
          </Badge>
          <Badge variant="secondary">{appliedFixes.length} Staged</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(4,160px)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search bugs, files, rules..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fileFilter} onValueChange={setFileFilter}>
              <SelectTrigger>
                <SelectValue placeholder="File" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Files</SelectItem>
                {fileNames.map((fileName) => (
                  <SelectItem key={fileName} value={fileName}>
                    {fileName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {languages.map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={setSortMode}>
              <SelectTrigger>
                <ArrowDownAZ className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="file">File + line</SelectItem>
                <SelectItem value="severity">Severity name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-[680px] gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="min-h-0 overflow-hidden">
          <CardContent className="flex h-full min-h-[680px] flex-col p-0">
            <div className="border-b p-4">
              <div className="flex items-center gap-2 font-medium">
                <ListTree className="h-4 w-4" />
                Issue Sidebar
              </div>
              <p className="text-sm text-muted-foreground">
                Grouped by scan priority
              </p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-3">
                <AnimatePresence>
                  {filteredIssues.map((issue) => {
                    const config = severityConfig[issue.severity]
                    const SeverityIcon = config.icon
                    const isSelected = issue.id === selectedIssue?.id

                    return (
                      <motion.button
                        key={issue.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        onClick={() => setSelectedIssueId(issue.id)}
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
                          isSelected && "border-primary bg-primary/5"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={cn("gap-1", config.className)}
                          >
                            <SeverityIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                          <Badge variant="secondary" className="text-[11px]">
                            {issue.category}
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-sm font-medium">
                          {issue.title}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{issue.filePath}</span>
                          <span className="shrink-0">
                            :{issue.lineNumber ?? 1}
                          </span>
                        </div>
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
                {filteredIssues.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No issues match these filters.
                  </div>
                )}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="grid min-h-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-h-0 overflow-hidden">
            <CardContent className="flex h-full min-h-[680px] flex-col p-0">
              <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="h-4 w-4" />
                    <p className="truncate font-medium">
                      {selectedIssue?.filePath ?? "No file selected"}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Line {selectedLine}, column {selectedIssue?.column ?? 1} ·{" "}
                    {selectedIssue?.language ?? "unknown"}
                  </p>
                </div>
                {selectedIssue && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText("line", selectedIssue.code)}
                  >
                    {copied === "line" ? (
                      <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    Copy Line
                  </Button>
                )}
              </div>

              <ScrollArea className="min-h-0 flex-1 overflow-hidden bg-zinc-950">
                <div className="min-w-max">
                  <pre className="min-h-full p-4 font-mono text-sm text-zinc-100">
                    {selectedLines.map((line, index) => {
                      const lineNumber = index + 1
                      const isProblemLine =
                        lineNumber >= selectedLine &&
                        lineNumber <=
                          (selectedIssue?.endLineNumber ?? selectedLine)

                      return (
                        <code
                          key={`${lineNumber}-${line}`}
                          className={cn(
                            "grid grid-cols-[48px_minmax(0,1fr)] gap-4 rounded px-2 py-0.5",
                            isProblemLine &&
                            "bg-red-500/20 text-red-100 ring-1 ring-red-400/30"
                          )}
                        >
                          <span className="select-none text-right text-zinc-500">
                            {lineNumber}
                          </span>
                          <span>{line || " "}</span>
                        </code>
                      )
                    })}
                  </pre>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="min-h-0 overflow-hidden">
            <CardContent className="flex h-full min-h-[680px] flex-col p-0">
              {selectedIssue ? (
                <>
                  <div className="space-y-3 border-b p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={
                          severityConfig[selectedIssue.severity].className
                        }
                      >
                        {severityConfig[selectedIssue.severity].label}
                      </Badge>
                      <Badge variant="secondary">
                        {selectedIssue.category}
                      </Badge>
                      <Badge variant="outline">{selectedIssue.analyzer}</Badge>
                    </div>
                    <div>
                      <h2 className="font-semibold">{selectedIssue.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedIssue.message}
                      </p>
                    </div>
                  </div>

                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-4 p-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-md border p-3">
                          <p className="text-muted-foreground">Category Bugs</p>
                          <p className="text-lg font-semibold">
                            {selectedCategoryCount}
                          </p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-muted-foreground">Language</p>
                          <p className="text-lg font-semibold capitalize">
                            {selectedIssue.language}
                          </p>
                        </div>
                      </div>

                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium">
                          Issue Details
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 pt-3 text-sm text-muted-foreground">
                          <p>
                            Rule {selectedIssue.ruleId ?? "unknown"} reported
                            this at {selectedIssue.filePath}:
                            {selectedIssue.lineNumber ?? 1}.
                          </p>
                          <p>
                            Prioritize this before lower severity findings if it
                            blocks reliability, security, or maintainability.
                          </p>
                        </CollapsibleContent>
                      </Collapsible>

                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium">
                          Suggested Fix Preview
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <div className="overflow-hidden rounded-md border border-success/20 bg-success/10">
                            <ScrollArea className="h-auto w-full">
                              <pre className="min-w-max whitespace-pre-wrap p-3 font-mono text-sm text-success">
                                {selectedIssue.suggestedFix}
                              </pre>
                              <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            copyText("fix", selectedIssue.suggestedFix)
                          }
                        >
                          {copied === "fix" ? (
                            <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          Copy Fix
                        </Button>
                        <Button onClick={() => autoFix(selectedIssue)}>
                          {appliedFixes.includes(selectedIssue.id) ? (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          ) : (
                            <Wand2 className="mr-2 h-4 w-4" />
                          )}
                          {appliedFixes.includes(selectedIssue.id)
                            ? "Fix Staged"
                            : "Auto-Fix"}
                        </Button>
                      </div>
                    </div>
                    <ScrollBar orientation="vertical" />
                  </ScrollArea>
                </>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  Select an issue to inspect the code and fix preview.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category} variant="outline">
                {category}:{" "}
                {issues.filter((issue) => issue.category === category).length}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
