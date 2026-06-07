"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { CalendarDays, Mail, Settings, ShieldCheck, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient, type AuthUser } from "@/lib/auth-client"

export default function ProfilePage() {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    authClient
      .profile()
      .then(({ user }) => setUser(user))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const displayName = user.username ?? "Developer"
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const joinedAt = user.createdAt ? new Date(user.createdAt) : new Date()

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">Your account identity and public details</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/settings">
            <Settings className="mr-2 h-4 w-4" />
            Edit profile
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <Avatar className="h-24 w-24">
            <AvatarImage src={user.avatarUrl ?? ""} alt={displayName} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">{displayName}</h2>
              <p className="text-sm text-muted-foreground">{user.bio || "No bio added yet."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <Mail className="mr-1 h-3 w-3" />
                {user.email}
              </Badge>
              <Badge variant={user.emailVerifiedAt ? "secondary" : "outline"}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {user.emailVerifiedAt ? "Verified" : "Verification pending"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Theme</span>
              <span className="capitalize">{user.theme ?? "system"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Email alerts</span>
              <span>{user.notificationPreferences?.email ? "Enabled" : "Disabled"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Joined</span>
              <span>{joinedAt.toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Workspace</span>
              <span>Personal</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
