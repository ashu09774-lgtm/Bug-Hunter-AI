import { Router } from "express"
import { z } from "zod"

import {
  cancelScanJob,
  createScanJob,
  getScanJob,
  listScanJobs,
} from "../services/scan-workflow-service"
import { AppError } from "../middleware/error-handler"
import { safeRelativePath, sanitizedString } from "../middleware/security"

const sourceFileSchema = z.object({
  path: safeRelativePath,
  content: z.string().max(500_000),
})

const createScanSchema = z
  .object({
    repositoryName: sanitizedString(1, 200),
    repositoryUrl: z.string().url().optional(),
    requestedLanguage: sanitizedString(1, 50).optional(),
    files: z.array(sourceFileSchema).min(1).max(100),
  })
  .superRefine((value, ctx) => {
    const totalBytes = value.files.reduce(
      (sum, file) => sum + Buffer.byteLength(file.content),
      0
    )
    if (totalBytes > 5 * 1024 * 1024) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["files"],
        message: "Scan payload must be 5MB or smaller",
      })
    }
  })

export const scansRouter = Router()

scansRouter.get("/", (_req, res) => {
  res.json({ success: true, data: listScanJobs() })
})

scansRouter.post("/", (req, res, next) => {
  try {
    const input = createScanSchema.parse(req.body)
    const job = createScanJob(input)

    res.status(202).json({ success: true, data: job })
  } catch (error) {
    next(error)
  }
})

scansRouter.get("/:scanId", (req, res, next) => {
  try {
    const job = getScanJob(req.params.scanId)
    if (!job) {
      throw new AppError("Scan job not found", 404, "SCAN_NOT_FOUND")
    }

    res.json({ success: true, data: job })
  } catch (error) {
    next(error)
  }
})

scansRouter.post("/:scanId/cancel", (req, res, next) => {
  try {
    const job = cancelScanJob(req.params.scanId)
    if (!job) {
      throw new AppError("Scan job not found", 404, "SCAN_NOT_FOUND")
    }

    res.json({ success: true, data: job })
  } catch (error) {
    next(error)
  }
})
