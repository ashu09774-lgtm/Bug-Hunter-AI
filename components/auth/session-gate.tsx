"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { authClient, type AuthUser } from "@/lib/auth-client"

type SessionGateProps = {
  children: React.ReactNode
  onUserLoaded?: (user: AuthUser) => void
}

export function SessionGate({ children, onUserLoaded }: SessionGateProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let isMounted = true

    authClient
      .me()
      .then(({ user }) => {
        if (!isMounted) return
        onUserLoaded?.(user)
        setIsLoading(false)
      })
      .catch(() => {
        authClient.clearToken()
        router.replace("/login")
      })

    return () => {
      isMounted = false
    }
  }, [onUserLoaded, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
