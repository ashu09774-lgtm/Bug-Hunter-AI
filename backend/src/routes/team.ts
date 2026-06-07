import { Router } from "express"
import { z } from "zod"

import { AppError } from "../middleware/error-handler"
import { sanitizedString } from "../middleware/security"
import {
  addIssueComment,
  assignIssue,
  getTeamWorkspace,
  inviteMember,
  shareRepository,
  updateMemberRole,
} from "../services/team-service"

const roleSchema = z.enum(["owner", "admin", "member"])

const inviteSchema = z.object({
  email: z.string().email(),
  role: roleSchema.default("member"),
})

const roleUpdateSchema = z.object({
  role: roleSchema,
})

const repositorySchema = z.object({
  name: sanitizedString(2, 120),
  url: z.string().url(),
  language: sanitizedString(1, 40),
  visibility: z.enum(["private", "public"]),
  sharedWith: z.array(sanitizedString(1, 120)).default([]),
})

const assignmentSchema = z.object({
  assigneeId: sanitizedString(1, 120).nullable(),
})

const commentSchema = z.object({
  authorId: sanitizedString(1, 120),
  body: sanitizedString(1, 1000),
})

export const teamRouter = Router()

teamRouter.get("/", (_req, res) => {
  res.json({ success: true, data: getTeamWorkspace() })
})

teamRouter.post("/members/invite", (req, res, next) => {
  try {
    const input = inviteSchema.parse(req.body)
    const member = inviteMember(input.email, input.role)

    res.status(201).json({ success: true, data: member })
  } catch (error) {
    next(error)
  }
})

teamRouter.patch("/members/:memberId/role", (req, res, next) => {
  try {
    const input = roleUpdateSchema.parse(req.body)
    const member = updateMemberRole(req.params.memberId, input.role)
    if (!member) {
      throw new AppError("Team member not found", 404, "TEAM_MEMBER_NOT_FOUND")
    }

    res.json({ success: true, data: member })
  } catch (error) {
    next(error)
  }
})

teamRouter.post("/repositories", (req, res, next) => {
  try {
    const input = repositorySchema.parse(req.body)
    const repository = shareRepository(input)

    res.status(201).json({ success: true, data: repository })
  } catch (error) {
    next(error)
  }
})

teamRouter.patch("/issues/:issueId/assign", (req, res, next) => {
  try {
    const input = assignmentSchema.parse(req.body)
    const issue = assignIssue(req.params.issueId, input.assigneeId)
    if (!issue) {
      throw new AppError("Issue not found", 404, "TEAM_ISSUE_NOT_FOUND")
    }

    res.json({ success: true, data: issue })
  } catch (error) {
    next(error)
  }
})

teamRouter.post("/issues/:issueId/comments", (req, res, next) => {
  try {
    const input = commentSchema.parse(req.body)
    const comment = addIssueComment(
      req.params.issueId,
      input.authorId,
      input.body
    )
    if (!comment) {
      throw new AppError("Issue not found", 404, "TEAM_ISSUE_NOT_FOUND")
    }

    res.status(201).json({ success: true, data: comment })
  } catch (error) {
    next(error)
  }
})
