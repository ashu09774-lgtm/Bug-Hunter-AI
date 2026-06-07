export type TeamRole = "owner" | "admin" | "member"
export type TeamMemberStatus = "active" | "invited"

export type TeamMember = {
  id: string
  name: string
  email: string
  avatarUrl: string
  role: TeamRole
  status: TeamMemberStatus
  lastActive: string
}

export type TeamRepository = {
  id: string
  name: string
  url: string
  language: string
  visibility: "private" | "public"
  sharedWith: string[]
  scans: number
  openIssues: number
}

export type TeamIssue = {
  id: string
  title: string
  repository: string
  filePath: string
  severity: "low" | "medium" | "high" | "critical"
  assigneeId: string | null
  status: "open" | "assigned" | "fixed"
  comments: TeamComment[]
}

export type TeamComment = {
  id: string
  authorId: string
  body: string
  createdAt: string
}

export type ActivityLog = {
  id: string
  actorId: string
  action: string
  target: string
  createdAt: string
}

const members: TeamMember[] = []

const repositories: TeamRepository[] = []

const issues: TeamIssue[] = []

const activity: ActivityLog[] = []

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function now() {
  return new Date().toISOString()
}

function actorName(actorId: string) {
  return members.find((member) => member.id === actorId)?.name ?? "System"
}

function logActivity(actorId: string, action: string, target: string) {
  activity.unshift({
    id: makeId("activity"),
    actorId,
    action,
    target,
    createdAt: now(),
  })
}

export function getTeamWorkspace() {
  return {
    workspace: {
      id: "workspace_default",
      name: "BugHunter Engineering",
      plan: "Team",
    },
    members,
    repositories,
    issues,
    activity: activity.map((item) => ({
      ...item,
      actorName: actorName(item.actorId),
    })),
  }
}

export function inviteMember(email: string, role: TeamRole) {
  const existing = members.find((member) => member.email.toLowerCase() === email.toLowerCase())
  if (existing) return existing

  const member: TeamMember = {
    id: makeId("member"),
    name: email.split("@")[0].replace(/[._-]/g, " "),
    email,
    avatarUrl: "",
    role,
    status: "invited",
    lastActive: "Pending",
  }

  members.push(member)
  logActivity("member_owner", "invited", email)
  return member
}

export function updateMemberRole(memberId: string, role: TeamRole) {
  const member = members.find((item) => item.id === memberId)
  if (!member) return null

  member.role = role
  logActivity("member_owner", "changed role for", member.name)
  return member
}

export function shareRepository(input: Omit<TeamRepository, "id" | "scans" | "openIssues">) {
  const repository: TeamRepository = {
    ...input,
    id: makeId("repo"),
    scans: 0,
    openIssues: 0,
  }

  repositories.unshift(repository)
  logActivity("member_owner", "shared repository", repository.name)
  return repository
}

export function assignIssue(issueId: string, assigneeId: string | null) {
  const issue = issues.find((item) => item.id === issueId)
  if (!issue) return null

  issue.assigneeId = assigneeId
  issue.status = assigneeId ? "assigned" : "open"
  logActivity("member_owner", assigneeId ? "assigned" : "unassigned", issue.title)
  return issue
}

export function addIssueComment(issueId: string, authorId: string, body: string) {
  const issue = issues.find((item) => item.id === issueId)
  if (!issue) return null

  const comment: TeamComment = {
    id: makeId("comment"),
    authorId,
    body,
    createdAt: now(),
  }

  issue.comments.push(comment)
  logActivity(authorId, "commented on", issue.title)
  return comment
}
