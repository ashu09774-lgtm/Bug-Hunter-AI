"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export default function VerifyEmailPage() {
  const [status, setStatus] = React.useState<"loading" | "success" | "error">("loading")

  React.useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token")

    if (!token) {
      setStatus("error")
      return
    }

    authClient
      .verifyEmail(token)
      .then(() => {
        setStatus("success")
        toast.success("Email verified")
      })
      .catch(() => {
        setStatus("error")
      })
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-6 h-10 w-10 animate-spin text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Verifying email</h1>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto mb-6 h-12 w-12 text-success" />
            <h1 className="text-2xl font-semibold tracking-tight">Email verified</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account is ready to use.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-6 h-12 w-12 text-destructive" />
            <h1 className="text-2xl font-semibold tracking-tight">Verification failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This verification link is missing, invalid, or expired.
            </p>
          </>
        )}

        <Button asChild className="mt-6">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    </div>
  )
}
