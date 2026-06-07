import { Router } from "express"

export const healthRouter = Router()

healthRouter.get("/", (_req, res) => {
  res.json({
    success: true,
    service: "ai-bug-detection-api",
    status: "ok",
    timestamp: new Date().toISOString(),
  })
})
