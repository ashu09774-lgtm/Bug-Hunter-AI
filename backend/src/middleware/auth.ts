import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"
import { prisma } from "../lib/prisma"
import { hashToken } from "../lib/tokens"
import { AppError } from "./error-handler"

export type AuthUser = {
  id: string
  email: string
  session: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization
  const bearerToken = header?.startsWith("Bearer ")
    ? header.slice(7)
    : undefined
  const cookieToken = req.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("auth_token="))
    ?.split("=")[1]

  const token =
    bearerToken ?? (cookieToken ? decodeURIComponent(cookieToken) : undefined)

  if (!token) {
    next(new AppError("Authentication required", 401, "AUTH_REQUIRED"))
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as Partial<AuthUser>

    if (!payload.id || !payload.email || !payload.session) {
      throw new AppError("Invalid or expired session", 401, "INVALID_SESSION")
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(payload.session) },
      select: { expiresAt: true, revokedAt: true },
    })

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new AppError("Invalid or expired session", 401, "INVALID_SESSION")
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      session: payload.session,
    }
    next()
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : new AppError("Invalid or expired session", 401, "INVALID_SESSION")
    )
  }
}
