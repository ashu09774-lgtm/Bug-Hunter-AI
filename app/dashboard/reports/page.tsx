"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Bug,
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  FileText,
  Link2,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Severity = "low" | "medium" | "high" | "critical"

type ScanJob = {
  id: string
  repositoryName: string
  repositoryUrl?: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  createdAt: string
  completedAt: string | null
  filesAnalyzed: number
  issuesTotal: number
  severityCounts: Record<Severity, number>
  languageSummary: Record<string, number>
  analyzerSummary: string[]
}

type Analytics = {
  totalScans: number
  completedScans: number
  failedScans: number
  totalIssues: number
  totalFiles: number
  averageIssuesPerScan: number
  averageIssuesPerFile: number
  severityDistribution: Record<Severity, number>
  securityStatistics: {
    totalSecurityIssues: number
    criticalSecurityIssues: number
  }
  categoryDistribution: Record<string, number>
  languageDistribution: Record<string, number>
  aiPerformance: {
    scansWithAnalyzerOutput: number
    analyzerCoveragePercent: number
    averageConfidence: number
  }
  bugTrends: Array<{
    scanId: string
    repositoryName: string
    date: string
    issues: number
    critical: number
    high: number
  }>
}

type ApiResponse<T> = {
  success: boolean
  data: T
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"

const severityColors: Record<Severity, string> = {
  critical: "var(--destructive)",
  high: "var(--warning)",
  medium: "var(--chart-1)",
  low: "var(--success)",
}

const emptyAnalytics: Analytics = {
  totalScans: 0,
  completedScans: 0,
  failedScans: 0,
  totalIssues: 0,
  totalFiles: 0,
  averageIssuesPerScan: 0,
  averageIssuesPerFile: 0,
  severityDistribution: {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  },
  securityStatistics: {
    totalSecurityIssues: 0,
    criticalSecurityIssues: 0,
  },
  categoryDistribution: {},
  languageDistribution: {},
  aiPerformance: {
    scansWithAnalyzerOutput: 0,
    analyzerCoveragePercent: 0,
    averageConfidence: 0,
  },
  bugTrends: [],
}

function formatDate(value: string | null) {
  if (!value) return "Pending"
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function topLanguage(scan: ScanJob) {
  const [language] =
    Object.entries(scan.languageSummary).sort((a, b) => b[1] - a[1])[0] ?? []
  return language ?? "unknown"
}

async function downloadReport(scanId: string, format: "pdf" | "json" | "csv") {
  const response = await fetch(`${apiBaseUrl}/reports/${scanId}/${format}`)
  if (!response.ok) {
    throw new Error(`Unable to export ${format.toUpperCase()} report.`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${scanId}.${format}`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [scans, setScans] = React.useState<ScanJob[]>([])
  const [analytics, setAnalytics] = React.useState<Analytics>(emptyAnalytics)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [copiedScanId, setCopiedScanId] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const loadReports = async () => {
      try {
        const [scanResponse, analyticsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/scans`),
          fetch(`${apiBaseUrl}/reports/analytics`),
        ])

        if (!scanResponse.ok || !analyticsResponse.ok) {
          throw new Error("Unable to load reports.")
        }

        const scanPayload = (await scanResponse.json()) as ApiResponse<ScanJob[]>
        const analyticsPayload = (await analyticsResponse.json()) as ApiResponse<Analytics>

        setScans(scanPayload.data)
        setAnalytics(analyticsPayload.data)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load reports.")
      } finally {
        setIsLoading(false)
      }
    }

    void loadReports()
  }, [])

  const filteredScans = scans.filter((scan) => {
    const matchesSearch = scan.repositoryName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || scan.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const severityData = (Object.entries(analytics.severityDistribution) as Array<[Severity, number]>)
    .map(([name, value]) => ({
      name,
      value,
      color: severityColors[name],
    }))
    .filter((item) => item.value > 0)

  const categoryData = Object.entries(analytics.categoryDistribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  const handleDownload = async (scanId: string, format: "pdf" | "json" | "csv") => {
    try {
      await downloadReport(scanId, format)
      toast.success(`${format.toUpperCase()} report downloaded`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.")
    }
  }

  const handleShare = async (scanId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/reports/${scanId}/share`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Unable to create share link.")
      }

      const payload = (await response.json()) as ApiResponse<{ url: string }>
      await navigator.clipboard.writeText(payload.data.url)
      setCopiedScanId(scanId)
      toast.success("Share link copied")
      setTimeout(() => setCopiedScanId(""), 1600)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to share report.")
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Export scan reports and track bug, security, and analyzer performance.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {isLoading ? "Loading" : `${filteredScans.length} reports`}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Scans",
            value: analytics.totalScans,
            icon: TrendingUp,
            note: `${analytics.completedScans} completed`,
          },
          {
            label: "Total Bugs",
            value: analytics.totalIssues,
            icon: Bug,
            note: `${analytics.averageIssuesPerScan} avg per scan`,
          },
          {
            label: "Security Issues",
            value: analytics.securityStatistics.totalSecurityIssues,
            icon: Shield,
            note: `${analytics.securityStatistics.criticalSecurityIssues} critical`,
          },
          {
            label: "Analyzer Coverage",
            value: `${analytics.aiPerformance.analyzerCoveragePercent}%`,
            icon: Sparkles,
            note: `${analytics.aiPerformance.scansWithAnalyzerOutput} scans with output`,
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-muted-foreground">{item.note}</span>
                </div>
                <p className="mt-4 text-2xl font-semibold">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bug Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.bugTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="repositoryName"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="issues" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="critical" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {severityData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82}>
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No completed scan data yet.
                </div>
              )}
            </div>
            <div className="space-y-2">
              {(["critical", "high", "medium", "low"] as Severity[]).map((severity) => (
                <div key={severity} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{severity}</span>
                    <span>{analytics.severityDistribution[severity]}</span>
                  </div>
                  <Progress
                    value={
                      analytics.totalIssues
                        ? (analytics.severityDistribution[severity] / analytics.totalIssues) * 100
                        : 0
                    }
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scan Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search repositories..."
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repository</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[310px]">Exports</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScans.map((scan) => (
                    <TableRow key={scan.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{scan.repositoryName}</p>
                          <p className="text-xs text-muted-foreground">{scan.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            scan.status === "completed" && "border-success/20 bg-success/10 text-success",
                            scan.status === "failed" && "border-destructive/20 bg-destructive/10 text-destructive",
                            scan.status === "running" && "border-chart-1/20 bg-chart-1/10 text-chart-1"
                          )}
                        >
                          {scan.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{topLanguage(scan)}</Badge>
                      </TableCell>
                      <TableCell>{scan.issuesTotal}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(scan.completedAt ?? scan.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={scan.status !== "completed"}
                            onClick={() => handleDownload(scan.id, "pdf")}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={scan.status !== "completed"}
                            onClick={() => handleDownload(scan.id, "json")}
                          >
                            <FileJson className="mr-2 h-4 w-4" />
                            JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={scan.status !== "completed"}
                            onClick={() => handleDownload(scan.id, "csv")}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            CSV
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={scan.status !== "completed"}
                            onClick={() => handleShare(scan.id)}
                          >
                            {copiedScanId === scan.id ? (
                              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                            ) : (
                              <Link2 className="mr-2 h-4 w-4" />
                            )}
                            Share
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {!filteredScans.length && (
              <div className="rounded-md border py-10 text-center text-sm text-muted-foreground">
                Run a scan to generate exportable reports.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryData.length ? (
              categoryData.map((category) => (
                <div key={category.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{category.name}</span>
                    <span>{category.value}</span>
                  </div>
                  <Progress
                    value={analytics.totalIssues ? (category.value / analytics.totalIssues) * 100 : 0}
                    className="h-2"
                  />
                </div>
              ))
            ) : (
              <div className="rounded-md border py-10 text-center text-sm text-muted-foreground">
                No issue categories yet.
              </div>
            )}

            <div className="rounded-md border p-4">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Copy className="h-4 w-4" />
                AI Performance
              </div>
              <p className="text-sm text-muted-foreground">
                Average confidence is{" "}
                {Math.round(analytics.aiPerformance.averageConfidence * 100)}% across analyzer-backed scans.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
