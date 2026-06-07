import { Router } from "express"
import { z } from "zod"

import {
  chatWithGemini,
  getAiUsageMetrics,
  reviewWithGemini,
} from "../services/gemini-service"
import { safeRelativePath, sanitizedString } from "../middleware/security"

const issueSchema = z.object({
  title: sanitizedString(0, 200).optional(),
  description: sanitizedString(0, 2_000).optional(),
  severity: sanitizedString(0, 20).optional(),
  filePath: safeRelativePath.optional(),
  lineNumber: z.number().optional(),
})

const aiReviewSchema = z.object({
  question: sanitizedString(0, 4_000).optional(),
  code: z.string().max(80_000).optional(),
  language: sanitizedString(0, 80).optional(),
  issue: issueSchema.optional(),
})

export const aiRouter = Router()

aiRouter.get("/usage", (_req, res) => {
  res.json({ success: true, data: getAiUsageMetrics() })
})

aiRouter.post("/review", async (req, res, next) => {
  try {
    const input = aiReviewSchema.parse(req.body)
    const result = await reviewWithGemini(input)

    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

aiRouter.post("/chat", async (req, res, next) => {
  try {
    const input = aiReviewSchema.parse(req.body)
    const result = await chatWithGemini(input)

    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})
