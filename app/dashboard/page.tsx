"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { motion, type Variants } from "framer-motion"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { RecentScans } from "@/components/dashboard/recent-scans"
import { AIConfidenceCards } from "@/components/dashboard/ai-confidence-cards"
import { Skeleton } from "@/components/ui/skeleton"

const SeverityChart = dynamic(
  () =>
    import("@/components/dashboard/severity-chart").then(
      (module) => module.SeverityChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[360px] w-full" />,
  }
)

const ScanSuccessChart = dynamic(
  () =>
    import("@/components/dashboard/scan-success-chart").then(
      (module) => module.ScanSuccessChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[360px] w-full" />,
  }
)

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  },
}

export default function DashboardPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your code analysis and bug detection metrics
        </p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants}>
        <StatsCards />
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <SeverityChart />
        </motion.div>
        <motion.div variants={itemVariants}>
          <ScanSuccessChart />
        </motion.div>
      </div>

      {/* AI Confidence Cards */}
      <motion.div variants={itemVariants}>
        <AIConfidenceCards />
      </motion.div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <RecentActivity />
        </motion.div>
        <motion.div variants={itemVariants}>
          <RecentScans />
        </motion.div>
      </div>
    </motion.div>
  )
}
