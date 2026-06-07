"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { SessionGate } from "@/components/auth/session-gate"
import { Sidebar } from "./sidebar"
import { Navbar } from "./navbar"

interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false)
  const [isDesktop, setIsDesktop] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    const updateViewport = () => setIsDesktop(mediaQuery.matches)

    updateViewport()
    mediaQuery.addEventListener("change", updateViewport)

    return () => mediaQuery.removeEventListener("change", updateViewport)
  }, [])

  const sidebarOffset = isDesktop ? (sidebarCollapsed ? 72 : 256) : 0

  return (
    <SessionGate>
      <div className="min-h-screen bg-background">
        <Sidebar
          collapsed={sidebarCollapsed}
          isDesktop={isDesktop}
          mobileOpen={mobileSidebarOpen}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onNavigate={() => setMobileSidebarOpen(false)}
        />
        {mobileSidebarOpen && (
          <button
            type="button"
            aria-label="Close workspace navigation"
            className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        <div className="flex flex-col">
          <Navbar
            sidebarOffset={sidebarOffset}
            onMenuClick={() => setMobileSidebarOpen(true)}
          />
          <motion.main
            initial={false}
            animate={{ marginLeft: sidebarOffset }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="min-h-[calc(100vh-4rem)] flex-1 px-4 py-5 sm:px-6 lg:p-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </motion.main>
        </div>
      </div>
    </SessionGate>
  )
}
