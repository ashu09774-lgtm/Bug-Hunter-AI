import { Router, type Request } from "express"
import {
  createPasswordReset,
  forgotPasswordSchema,
  getCurrentUser,
  getGoogleOAuthUrl,
  loginWithGoogleCode,
  login,
  loginSchema,
  resetPassword,
  resetPasswordSchema,
  signup,
  signupSchema,
  verifyEmail,
  verifyEmailSchema,
} from "../services/auth-service"
import { requireAuth } from "../middleware/auth"
import { prisma } from "../lib/prisma"
import { hashToken } from "../lib/tokens"
import { env } from "../config/env"
import { createRateLimiter } from "../middleware/security"
import { AppError } from "../middleware/error-handler"

export const authRouter = Router()

const authRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: env.AUTH_RATE_LIMIT_PER_MINUTE,
  keyPrefix: "auth",
})

const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
}

authRouter.post("/signup", authRateLimit, async (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body)
    const result = await signup(input)

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        emailVerificationToken:
          process.env.NODE_ENV === "production"
            ? undefined
            : result.emailVerifyToken,
      },
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const result = await login(input)

    res.cookie("auth_token", result.token, {
      ...authCookieOptions,
      expires: result.expiresAt,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
})

function googleRedirectUri(req: Request) {
  return `${req.protocol}://${req.get("host")}/api/auth/google/callback`
}

authRouter.get("/google/url", authRateLimit, (req, res, next) => {
  try {
    const nextPath =
      typeof req.query.next === "string" && req.query.next.startsWith("/")
        ? req.query.next
        : "/dashboard"
    const url = getGoogleOAuthUrl(googleRedirectUri(req), nextPath)

    res.json({ success: true, data: { url } })
  } catch (error) {
    next(error)
  }
})

authRouter.get("/google/callback", authRateLimit, async (req, res, next) => {
  try {
    if (typeof req.query.code !== "string") {
      throw new AppError(
        "Google OAuth callback is missing a code",
        400,
        "GOOGLE_OAUTH_CODE_MISSING"
      )
    }

    const result = await loginWithGoogleCode({
      code: req.query.code,
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      redirectUri: googleRedirectUri(req),
    })
    const appUrl = env.NEXT_PUBLIC_APP_URL ?? env.API_CORS_ORIGIN
    const redirectUrl = new URL(result.nextPath, appUrl)

    res.cookie("auth_token", result.token, {
      ...authCookieOptions,
      expires: result.expiresAt,
    })
    res.redirect(redirectUrl.toString())
  } catch (error) {
    next(error)
  }
})

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getCurrentUser(req.user!.id)

    res.json({
      success: true,
      data: { user },
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await prisma.session.updateMany({
      where: {
        tokenHash: hashToken(req.user!.session),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })

    res.clearCookie("auth_token", authCookieOptions)
    res.json({
      success: true,
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post("/forgot-password", authRateLimit, async (req, res, next) => {
  try {
    const input = forgotPasswordSchema.parse(req.body)
    const resetToken = await createPasswordReset(input)

    res.json({
      success: true,
      data: {
        message: "If an account exists, a reset email will be sent.",
        resetToken:
          process.env.NODE_ENV === "production" ? undefined : resetToken,
      },
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post("/reset-password", authRateLimit, async (req, res, next) => {
  try {
    const input = resetPasswordSchema.parse(req.body)
    await resetPassword(input)

    res.json({
      success: true,
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post("/verify-email", authRateLimit, async (req, res, next) => {
  try {
    const input = verifyEmailSchema.parse(req.body)
    await verifyEmail(input)

    res.json({
      success: true,
    })
  } catch (error) {
    next(error)
  }
})
