"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExternalLink } from "lucide-react"

type RecentScan = {
  id: string
  name: string
  language: string
  bugs: number
  severity: "high" | "medium" | "low" | "none"
  date: string
}

const scans: RecentScan[] = []

const severityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-success/10 text-success border-success/20",
  none: "bg-muted text-muted-foreground border-muted",
}

export function RecentScans() {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Recent Scans</CardTitle>
        <Button variant="ghost" size="sm" className="text-xs">
          View all
          <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Repository</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Bugs</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead className="pr-6">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scans.map((scan, index) => (
              <motion.tr
                key={scan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="group cursor-pointer transition-colors hover:bg-muted/50"
              >
                <TableCell className="pl-6 font-medium">{scan.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    {scan.language}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={scan.bugs > 0 ? "font-medium" : "text-muted-foreground"}>
                    {scan.bugs}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`capitalize ${severityColors[scan.severity]}`}
                  >
                    {scan.severity}
                  </Badge>
                </TableCell>
                <TableCell className="pr-6 text-muted-foreground">
                  {scan.date}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
