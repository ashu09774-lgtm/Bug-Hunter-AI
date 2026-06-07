"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  GitBranch,
  Play,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const steps = [
  {
    title: "Connect a repository",
    description: "Validate a GitHub URL or load demo repositories.",
    href: "/dashboard/repositories",
    icon: GitBranch,
  },
  {
    title: "Run analysis",
    description: "Scan JavaScript, TypeScript, or Python files.",
    href: "/dashboard/scan",
    icon: Play,
  },
  {
    title: "Review bugs",
    description: "Inspect severity, source lines, and suggested fixes.",
    href: "/dashboard/bugs",
    icon: ShieldCheck,
  },
  {
    title: "Ask AI",
    description: "Use contextual explanations and improvement guidance.",
    href: "/dashboard/ai-review",
    icon: Bot,
  },
  {
    title: "Export evidence",
    description: "Generate PDF, JSON, CSV, and shared reports.",
    href: "/dashboard/reports",
    icon: FileText,
  },
]

export default function OnboardingPage() {
  const [completed, setCompleted] = React.useState<string[]>([])

  React.useEffect(() => {
    setCompleted(
      JSON.parse(localStorage.getItem("bughunter.onboarding") ?? "[]")
    )
  }, [])

  const progress = Math.round((completed.length / steps.length) * 100)

  const toggleStep = (title: string) => {
    const next = completed.includes(title)
      ? completed.filter((item) => item !== title)
      : [...completed, title]

    setCompleted(next)
    localStorage.setItem("bughunter.onboarding", JSON.stringify(next))
  }



  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">
            Final polish
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
          <p className="max-w-2xl text-muted-foreground">
            Set up a realistic BugHunter workspace and walk through the full
            debugging flow from repository intake to report export.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard/scan">
              Start Scan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Workspace readiness</p>
              <p className="text-sm text-muted-foreground">
                {completed.length} of {steps.length} steps checked
              </p>
            </div>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isComplete = completed.includes(step.title)

          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <button
                      type="button"
                      aria-label={`Mark ${step.title} ${isComplete ? "incomplete" : "complete"}`}
                      onClick={() => toggleStep(step.title)}
                      className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <CheckCircle2
                        className={
                          isComplete ? "h-5 w-5 text-success" : "h-5 w-5"
                        }
                      />
                    </button>
                  </div>
                  <div className="min-h-[96px]">
                    <h2 className="font-medium">{step.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="mt-auto"
                  >
                    <Link href={step.href}>Open</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
