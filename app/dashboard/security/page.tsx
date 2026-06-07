"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Shield,
  AlertTriangle,
  Lock,
  Key,
  Globe,
  Package,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

const securityIssues = [
  {
    id: 1,
    title: "Exposed API Key",
    description: "An API key was found hardcoded in config/api.js",
    severity: "critical",
    category: "Secrets",
    file: "config/api.js",
    line: 12,
    recommendation: "Move API keys to environment variables and add the file to .gitignore",
  },
  {
    id: 2,
    title: "Outdated Dependency",
    description: "lodash@4.17.15 has a known prototype pollution vulnerability",
    severity: "high",
    category: "Dependencies",
    file: "package.json",
    recommendation: "Upgrade lodash to version 4.17.21 or higher",
  },
  {
    id: 3,
    title: "Missing HTTPS",
    description: "External API calls are made over HTTP instead of HTTPS",
    severity: "high",
    category: "Network",
    file: "src/api/client.ts",
    line: 34,
    recommendation: "Update all API endpoints to use HTTPS protocol",
  },
  {
    id: 4,
    title: "Weak Password Policy",
    description: "Password validation allows weak passwords without special characters",
    severity: "medium",
    category: "Authentication",
    file: "src/auth/validation.ts",
    line: 56,
    recommendation: "Implement stronger password requirements including special characters and minimum length",
  },
  {
    id: 5,
    title: "Missing Rate Limiting",
    description: "API endpoints lack rate limiting protection",
    severity: "medium",
    category: "API",
    file: "src/api/routes.ts",
    recommendation: "Implement rate limiting middleware to prevent abuse",
  },
]

const securityMetrics = [
  { label: "Security Score", value: 72, max: 100, color: "bg-warning" },
  { label: "Dependencies Safe", value: 89, max: 100, color: "bg-success" },
  { label: "Code Coverage", value: 78, max: 100, color: "bg-chart-1" },
]

const severityConfig = {
  critical: { label: "Critical", color: "bg-destructive text-destructive-foreground", icon: Shield },
  high: { label: "High", color: "bg-warning text-warning-foreground", icon: AlertTriangle },
  medium: { label: "Medium", color: "bg-chart-1/20 text-chart-1", icon: AlertTriangle },
  low: { label: "Low", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
}

const categoryIcons = {
  Secrets: Key,
  Dependencies: Package,
  Network: Globe,
  Authentication: Lock,
  API: Globe,
}

export default function SecurityPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Analysis</h1>
          <p className="text-muted-foreground">
            Vulnerability assessment and security recommendations
          </p>
        </div>
        <Button>
          Run Security Scan
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        {securityMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <span className="text-2xl font-semibold">{metric.value}%</span>
                </div>
                <Progress value={metric.value} className="h-2" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(
          securityIssues.reduce((acc, issue) => {
            acc[issue.severity] = (acc[issue.severity] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        ).map(([severity, count], index) => {
          const config = severityConfig[severity as keyof typeof severityConfig]
          const Icon = config.icon
          return (
            <motion.div
              key={severity}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="transition-all duration-200 hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", config.color.split(" ")[0])}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{count}</p>
                      <p className="text-sm text-muted-foreground capitalize">{severity}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Issues List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Issues</CardTitle>
          <CardDescription>
            {securityIssues.length} vulnerabilities detected in your codebase
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {securityIssues.map((issue, index) => {
              const config = severityConfig[issue.severity as keyof typeof severityConfig]
              const CategoryIcon = categoryIcons[issue.category as keyof typeof categoryIcons] || Shield
              return (
                <motion.div
                  key={issue.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", config.color.split(" ")[0])}>
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-medium">{issue.title}</h4>
                        <Badge variant="outline" className={config.color}>
                          {config.label}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {issue.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{issue.file}</span>
                        {issue.line && <span>Line {issue.line}</span>}
                      </div>
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm">
                        <p className="font-medium text-xs text-muted-foreground mb-1">Recommendation</p>
                        <p>{issue.recommendation}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Fix
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
