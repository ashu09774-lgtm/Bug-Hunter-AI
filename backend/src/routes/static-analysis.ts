import { Router } from "express"
import { z } from "zod"

import {
  analyzeJavaScriptFiles,
  analyzePythonFiles,
  analyzeSourceFiles,
  parseBanditJson,
  parsePylintJson,
} from "../services/static-analysis-service"
import { safeRelativePath } from "../middleware/security"

const sourceFileSchema = z.object({
  path: safeRelativePath,
  content: z.string().max(500_000),
})

const analysisSchema = z
  .object({
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
        message: "Analysis payload must be 5MB or smaller",
      })
    }
  })

const parserSchema = z.object({
  output: z.string().min(1),
})

export const staticAnalysisRouter = Router()

staticAnalysisRouter.post("/javascript", async (req, res, next) => {
  try {
    const input = analysisSchema.parse(req.body)
    const result = await analyzeJavaScriptFiles(input.files)

    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

staticAnalysisRouter.post("/python", async (req, res, next) => {
  try {
    const input = analysisSchema.parse(req.body)
    const result = await analyzePythonFiles(input.files)

    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

staticAnalysisRouter.post("/source", async (req, res, next) => {
  try {
    const input = analysisSchema.parse(req.body)
    const result = await analyzeSourceFiles(input.files)

    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

staticAnalysisRouter.post("/parse/pylint", (req, res, next) => {
  try {
    const input = parserSchema.parse(req.body)

    res.json({
      success: true,
      data: { issues: parsePylintJson(input.output) },
    })
  } catch (error) {
    next(error)
  }
})

staticAnalysisRouter.post("/parse/bandit", (req, res, next) => {
  try {
    const input = parserSchema.parse(req.body)

    res.json({
      success: true,
      data: { issues: parseBanditJson(input.output) },
    })
  } catch (error) {
    next(error)
  }
})
