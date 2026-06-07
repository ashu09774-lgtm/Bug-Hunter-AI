import type { ErrorRequestHandler } from "express"
import { Prisma } from "@prisma/client"
import { ZodError } from "zod"
import { logger } from "../lib/logger"

const databaseUnavailableMessage =
  "Database is not reachable. If you use Supabase on an IPv4-only network, use the Supabase Session Pooler connection string in DATABASE_URL."

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code = "INTERNAL_SERVER_ERROR"
  ) {
    super(message)
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Invalid request body",
      },
    })
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const databaseErrors: Record<
      string,
      { statusCode: number; message: string }
    > = {
      P1001: {
        statusCode: 503,
        message: databaseUnavailableMessage,
      },
      P2021: {
        statusCode: 503,
        message: "Database schema is not ready. Run npm run db:migrate.",
      },
      P2022: {
        statusCode: 503,
        message: "Database schema is out of date. Run npm run db:migrate.",
      },
    }
    const databaseError = databaseErrors[error.code]

    if (databaseError) {
      logger.error({ error, code: error.code }, databaseError.message)
      res.status(databaseError.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: databaseError.message,
        },
      })
      return
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ error, code: error.errorCode }, "Database is not reachable")
    res.status(503).json({
      success: false,
      error: {
        code: error.errorCode ?? "DATABASE_UNAVAILABLE",
        message: databaseUnavailableMessage,
      },
    })
    return
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    })
    return
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500
  const code = error instanceof AppError ? error.code : "INTERNAL_SERVER_ERROR"
  const message =
    error instanceof AppError ? error.message : "Something went wrong"

  logger.error({ error, code }, message)

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  })
}
