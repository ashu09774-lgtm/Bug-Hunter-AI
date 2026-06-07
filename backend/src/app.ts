import cors from "cors"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import { env } from "./config/env"
import { errorHandler } from "./middleware/error-handler"
import { createRateLimiter } from "./middleware/security"
import { apiRouter } from "./routes"

export function createApp() {
  const app = express()

  app.disable("x-powered-by")
  app.set("trust proxy", 1)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
    })
  )
  app.use(
    cors({
      origin: env.API_CORS_ORIGIN,
      credentials: true,
    })
  )
  app.use(express.json({ limit: env.API_JSON_LIMIT }))
  app.use(
    createRateLimiter({
      windowMs: 60_000,
      max: env.API_RATE_LIMIT_PER_MINUTE,
      keyPrefix: "api",
    })
  )
  app.use(morgan("combined"))

  app.use("/api", apiRouter)
  app.use(errorHandler)

  return app
}
