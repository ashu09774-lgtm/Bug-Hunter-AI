"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  Activity,
  Bug,
  CheckCircle2,
  Crown,
  GitBranch,
  Mail,
  MessageSquare,
  Plus,
  Shield,
  User,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type TeamRole = "owner" | "admin" | "member"
type MemberStatus = "active" | "invited"
type Severity = "low" | "medium" | "high" | "critical"

type TeamMember = {
  id: string
  name: string
  email: string
  avatarUrl: string
  role: TeamRole
  status: MemberStatus
  lastActive: string
}

type TeamRepository = {
  id: string
  name: string
  url: string
  language: string
  visibility: "private" | "public"
  sharedWith: string[]
  scans: number
  openIssues: number
}

type TeamComment = {
  id: string
  authorId: string
  body: string
  createdAt: string
}

type TeamIssue = {
  id: string
  title: string
  repository: string
  filePath: string
  severity: Severity
  assigneeId: string | null
  status: "open" | "assigned" | "fixed"
  comments: TeamComment[]
}

type ActivityLog = {
  id: string
  actorId: string
  actorName: string
  action: string
  target: string
  createdAt: string
}

type WorkspacePayload = {
  workspace: {
    id: string
    name: string
    plan: string
  }
  members: TeamMember[]
  repositories: TeamRepository[]
  issues: TeamIssue[]
  activity: ActivityLog[]
}

type ApiResponse<T> = {
  success: boolean
  data: T
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"

const roleConfig = {
  owner: { label: "Owner", icon: Crown, color: "text-warning" },
  admin: { label: "Admin", icon: Shield, color: "text-chart-1" },
  member: { label: "Member", icon: User, color: "text-muted-foreground" },
} satisfies Record<TeamRole, { label: string; icon: React.ElementType; color: string }>

const severityClass: Record<Severity, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-warning/10 text-warning border-warning/20",
  medium: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  low: "bg-muted text-muted-foreground",
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function TeamPage() {
  const [workspace, setWorkspace] = React.useState<WorkspacePayload | null>(null)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<TeamRole>("member")
  const [repoName, setRepoName] = React.useState("")
  const [repoUrl, setRepoUrl] = React.useState("")
  const [repoLanguage, setRepoLanguage] = React.useState("TypeScript")
  const [commentDrafts, setCommentDrafts] = React.useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = React.useState(true)

  const loadWorkspace = React.useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/team`)
    if (!response.ok) {
      throw new Error("Unable to load team workspace.")
    }

    const payload = (await response.json()) as ApiResponse<WorkspacePayload>
    setWorkspace(payload.data)
  }, [])

  React.useEffect(() => {
    loadWorkspace()
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load team."))
      .finally(() => setIsLoading(false))
  }, [loadWorkspace])

  const members = workspace?.members ?? []
  const activeMembers = members.filter((member) => member.status === "active")
  const invitedMembers = members.filter((member) => member.status === "invited")
  const ownerId = members.find((member) => member.role === "owner")?.id ?? members[0]?.id ?? ""

  const refresh = async () => {
    await loadWorkspace()
  }

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return

    const response = await fetch(`${apiBaseUrl}/team/members/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })

    if (!response.ok) {
      toast.error("Invite could not be sent.")
      return
    }

    setInviteEmail("")
    setInviteRole("member")
    await refresh()
    toast.success("Invite sent")
  }

  const updateRole = async (memberId: string, role: TeamRole) => {
    const response = await fetch(`${apiBaseUrl}/team/members/${memberId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })

    if (!response.ok) {
      toast.error("Role update failed.")
      return
    }

    await refresh()
    toast.success("Role updated")
  }

  const shareRepository = async () => {
    if (!repoName.trim() || !repoUrl.trim()) return

    const response = await fetch(`${apiBaseUrl}/team/repositories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: repoName,
        url: repoUrl,
        language: repoLanguage,
        visibility: "private",
        sharedWith: activeMembers.map((member) => member.id),
      }),
    })

    if (!response.ok) {
      toast.error("Repository could not be shared.")
      return
    }

    setRepoName("")
    setRepoUrl("")
    await refresh()
    toast.success("Repository shared")
  }

  const assignIssue = async (issueId: string, assigneeId: string) => {
    const response = await fetch(`${apiBaseUrl}/team/issues/${issueId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId: assigneeId === "unassigned" ? null : assigneeId }),
    })

    if (!response.ok) {
      toast.error("Assignment failed.")
      return
    }

    await refresh()
    toast.success("Issue assignment updated")
  }

  const addComment = async (issueId: string) => {
    const body = commentDrafts[issueId]?.trim()
    if (!body) return

    const response = await fetch(`${apiBaseUrl}/team/issues/${issueId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorId: ownerId, body }),
    })

    if (!response.ok) {
      toast.error("Comment could not be added.")
      return
    }

    setCommentDrafts((current) => ({ ...current, [issueId]: "" }))
    await refresh()
    toast.success("Comment added")
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Workspace</h1>
          <p className="text-muted-foreground">
            {isLoading
              ? "Loading collaboration workspace..."
              : `${workspace?.workspace.name ?? "Workspace"} · ${workspace?.workspace.plan ?? "Team"} plan`}
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {activeMembers.length} active · {invitedMembers.length} invited
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Members", value: members.length, icon: Users },
          { label: "Shared Repos", value: workspace?.repositories.length ?? 0, icon: GitBranch },
          { label: "Assigned Issues", value: workspace?.issues.filter((issue) => issue.assigneeId).length ?? 0, icon: Bug },
          { label: "Activity Logs", value: workspace?.activity.length ?? 0, icon: Activity },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:inline-grid lg:w-auto">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="repositories">Repos</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invite Members</CardTitle>
              <CardDescription>Send an invitation and assign an initial role.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as TeamRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={inviteMember}>
                  <Plus className="mr-2 h-4 w-4" />
                  Send Invite
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">People With Access</CardTitle>
              <CardDescription>Update roles and review invite status.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {members.map((member) => {
                  const roleInfo = roleConfig[member.role]
                  const RoleIcon = roleInfo.icon
                  return (
                    <div key={member.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.avatarUrl} />
                          <AvatarFallback>{initials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium capitalize">{member.name}</p>
                            {member.status === "invited" && <Badge variant="secondary">Pending</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <RoleIcon className={cn("h-4 w-4", roleInfo.color)} />
                          <span>{roleInfo.label}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{member.lastActive}</span>
                        <Select
                          value={member.role}
                          disabled={member.role === "owner"}
                          onValueChange={(value) => updateRole(member.id, value as TeamRole)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repositories" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Share Repository</CardTitle>
              <CardDescription>Add a repository to the team workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_160px_auto]">
                <Input placeholder="repository-name" value={repoName} onChange={(event) => setRepoName(event.target.value)} />
                <Input placeholder="https://github.com/org/repo" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />
                <Select value={repoLanguage} onValueChange={setRepoLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TypeScript">TypeScript</SelectItem>
                    <SelectItem value="JavaScript">JavaScript</SelectItem>
                    <SelectItem value="Python">Python</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={shareRepository}>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {workspace?.repositories.map((repository) => (
              <Card key={repository.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-lg">
                    <span>{repository.name}</span>
                    <Badge variant={repository.visibility === "private" ? "secondary" : "outline"}>
                      {repository.visibility}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{repository.url}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Language</p>
                      <p className="font-medium">{repository.language}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Scans</p>
                      <p className="font-medium">{repository.scans}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Open</p>
                      <p className="font-medium">{repository.openIssues}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {repository.sharedWith.map((memberId) => {
                      const member = members.find((item) => item.id === memberId)
                      return member ? (
                        <Badge key={memberId} variant="outline">
                          {member.name}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          {workspace?.issues.map((issue) => {
            const assignee = members.find((member) => member.id === issue.assigneeId)
            return (
              <Card key={issue.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="text-lg">{issue.title}</CardTitle>
                      <CardDescription>
                        {issue.repository} · {issue.filePath}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={severityClass[issue.severity]}>
                        {issue.severity}
                      </Badge>
                      <Badge variant="secondary">{assignee ? assignee.name : "Unassigned"}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Assign Issue</p>
                    <Select
                      value={issue.assigneeId ?? "unassigned"}
                      onValueChange={(value) => assignIssue(issue.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {activeMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="h-4 w-4" />
                      Comments
                    </div>
                    <ScrollArea className="max-h-44 rounded-md border p-3">
                      <div className="space-y-3">
                        {issue.comments.length ? (
                          issue.comments.map((comment) => {
                            const author = members.find((member) => member.id === comment.authorId)
                            return (
                              <div key={comment.id} className="rounded-md bg-muted/50 p-3">
                                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{author?.name ?? "Unknown"}</span>
                                  <span>{formatTime(comment.createdAt)}</span>
                                </div>
                                <p className="text-sm">{comment.body}</p>
                              </div>
                            )
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground">No comments yet.</p>
                        )}
                      </div>
                    </ScrollArea>
                    <div className="flex gap-2">
                      <Textarea
                        value={commentDrafts[issue.id] ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({ ...current, [issue.id]: event.target.value }))
                        }
                        placeholder="Add a review note..."
                        className="min-h-[44px]"
                      />
                      <Button className="h-[44px]" onClick={() => addComment(issue.id)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Logs</CardTitle>
              <CardDescription>Workspace collaboration events.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workspace?.activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-md border p-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">{item.actorName}</span> {item.action}{" "}
                        <span className="font-medium">{item.target}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatTime(item.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
