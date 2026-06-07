"use client"

import { useEffect } from "react"

import { ErrorState } from "@/components/layout/page-state"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <ErrorState
      description="The dashboard could not render this view. Try again to reload the workspace."
      onRetry={reset}
    />
  )
}
