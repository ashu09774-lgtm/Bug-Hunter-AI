"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { LucideIcon } from "lucide-react"

type ConfidenceMetric = {
  name: string
  description: string
  value: number
  color: string
  icon: LucideIcon
}

const confidenceMetrics: ConfidenceMetric[] = []

export function AIConfidenceCards() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">AI Confidence Scores</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {confidenceMetrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <motion.div
              key={metric.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="group overflow-hidden transition-all duration-300 hover:shadow-md hover:border-foreground/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted transition-transform duration-300 group-hover:scale-110`}
                    >
                      <Icon className={`h-4 w-4 ${metric.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{metric.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {metric.description}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                        className="text-2xl font-semibold"
                      >
                        {metric.value}%
                      </motion.span>
                      <span className="text-xs text-muted-foreground">
                        confidence
                      </span>
                    </div>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 0.8, delay: index * 0.1 + 0.2 }}
                    >
                      <Progress value={metric.value} className="h-1.5" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
