import type { NextFunction, Request, Response } from "express"
import { z } from "zod"
import { AppError } from "./error-handler"

type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()

const htmlEntityMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export function sanitizeText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .trim()
    .replace(/[&<>"']/g, (char) => htmlEntityMap[char] ?? char)
}

export const sanitizedString = (min = 0, max = 1_000) =>
  z.preprocess(
    (value) => (typeof value === "string" ? sanitizeText(value) : value),
    z.string().min(min).max(max)
  )

export const safeRelativePath = z
  .preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .replace(/\u0000/g, "")
            .trim()
            .replaceAll("\\", "/")
        : value,
    z.string().min(1).max(500)
  )
  .refine((value) => !value.startsWith("/") && !value.includes(".."), {
    message: "File path must be a safe relative path",
  })
  .refine((value) => !/[<>:"|?*\u0000-\u001f]/.test(value), {
    message: "File path contains unsafe characters",
  })

export function createRateLimiter(options: {
  windowMs: number
  max: number
  keyPrefix: string
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    const key = `${options.keyPrefix}:${req.ip ?? "unknown"}`
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
      next()
      return
    }

    bucket.count += 1

    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
      res.setHeader("Retry-After", String(retryAfter))
      next(
        new AppError(
          "Too many requests. Please try again shortly.",
          429,
          "RATE_LIMITED"
        )
      )
      return
    }

    next()
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}, 60_000).unref()
