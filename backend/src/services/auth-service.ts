import bcrypt from "bcryptjs"
import { google } from "googleapis"
import jwt from "jsonwebtoken"
import { z } from "zod"
import { env } from "../config/env"
import { prisma } from "../lib/prisma"
import { createOpaqueToken, hashToken } from "../lib/tokens"
import { AppError } from "../middleware/error-handler"
import { sanitizedString } from "../middleware/security"

export const signupSchema = z.object({
  username: sanitizedString(2, 80),
  email: z.string().email().toLowerCase(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number"),
})

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number"),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(32),
})

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  bio: true,
  avatarUrl: true,
  theme: true,
  notificationPreferences: true,
  emailVerifiedAt: true,
  createdAt: true,
}

function publicUserPayload(user: {
  id: string
  email: string
  username: string | null
  avatarUrl: string | null
  emailVerifiedAt: Date | null
  createdAt: Date
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  }
}

async function createLoginSession(
  user: {
    id: string
    email: string
    username: string | null
    avatarUrl: string | null
    emailVerifiedAt: Date | null
    createdAt: Date
  },
  rememberMe = false
) {
  const expiresInDays = rememberMe ? 30 : 7
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * expiresInDays)
  const sessionToken = createOpaqueToken()

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      expiresAt,
    },
  })

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      session: sessionToken,
    },
    env.JWT_SECRET,
    { expiresIn: `${expiresInDays}d` }
  )

  return {
    token,
    expiresAt,
    user: publicUserPayload(user),
  }
}

export async function signup(input: z.infer<typeof signupSchema>) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })

  if (existingUser) {
    throw new AppError(
      "An account already exists for this email",
      409,
      "EMAIL_IN_USE"
    )
  }

  const emailVerifyToken = createOpaqueToken()
  const passwordHash = await bcrypt.hash(input.password, 12)

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      emailVerifyTokenHash: hashToken(emailVerifyToken),
      emailVerifyExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
    select: publicUserSelect,
  })

  return {
    user,
    emailVerifyToken,
  }
}

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  })

  if (!user?.passwordHash) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS")
  }

  const isValidPassword = await bcrypt.compare(
    input.password,
    user.passwordHash
  )

  if (!isValidPassword) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS")
  }

  return createLoginSession(user, input.rememberMe)
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  })

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND")
  }

  return user
}

export async function createPasswordReset(
  input: z.infer<typeof forgotPasswordSchema>
) {
  const resetToken = createOpaqueToken()
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordTokenHash: hashToken(resetToken),
        resetPasswordExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    })
  }

  return resetToken
}

export async function resetPassword(
  input: z.infer<typeof resetPasswordSchema>
) {
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordTokenHash: hashToken(input.token),
      resetPasswordExpiresAt: {
        gt: new Date(),
      },
    },
  })

  if (!user) {
    throw new AppError(
      "Invalid or expired reset token",
      400,
      "INVALID_RESET_TOKEN"
    )
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(input.password, 12),
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
    },
  })
}

export async function verifyEmail(input: z.infer<typeof verifyEmailSchema>) {
  const user = await prisma.user.findFirst({
    where: {
      emailVerifyTokenHash: hashToken(input.token),
      emailVerifyExpiresAt: {
        gt: new Date(),
      },
    },
  })

  if (!user) {
    throw new AppError(
      "Invalid or expired verification token",
      400,
      "INVALID_VERIFY_TOKEN"
    )
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerifyTokenHash: null,
      emailVerifyExpiresAt: null,
    },
  })
}

function createGoogleOAuthClient(redirectUri: string) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError(
      "Google OAuth is not configured",
      503,
      "GOOGLE_OAUTH_NOT_CONFIGURED"
    )
  }

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )
}

export function getGoogleOAuthUrl(redirectUri: string, nextPath = "/dashboard") {
  const client = createGoogleOAuthClient(redirectUri)
  const state = jwt.sign({ nextPath }, env.JWT_SECRET, { expiresIn: "10m" })

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  })
}

export async function loginWithGoogleCode(input: {
  code: string
  redirectUri: string
  state?: string
}) {
  const client = createGoogleOAuthClient(input.redirectUri)
  const { tokens } = await client.getToken(input.code)

  if (!tokens.id_token) {
    throw new AppError(
      "Google did not return an identity token",
      502,
      "GOOGLE_ID_TOKEN_MISSING"
    )
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  })
  const payload = ticket.getPayload()

  if (!payload?.email) {
    throw new AppError(
      "Google account does not include a verified email",
      400,
      "GOOGLE_EMAIL_MISSING"
    )
  }

  const user = await prisma.user.upsert({
    where: { email: payload.email.toLowerCase() },
    update: {
      username: payload.name ?? undefined,
      avatarUrl: payload.picture ?? undefined,
      emailVerifiedAt: payload.email_verified ? new Date() : undefined,
    },
    create: {
      email: payload.email.toLowerCase(),
      username: payload.name ?? payload.email.split("@")[0],
      avatarUrl: payload.picture,
      emailVerifiedAt: payload.email_verified ? new Date() : null,
    },
  })

  let nextPath = "/dashboard"
  if (input.state) {
    try {
      const decoded = jwt.verify(input.state, env.JWT_SECRET) as {
        nextPath?: string
      }
      if (decoded.nextPath?.startsWith("/")) {
        nextPath = decoded.nextPath
      }
    } catch {
      throw new AppError("Invalid Google OAuth state", 400, "INVALID_OAUTH_STATE")
    }
  }

  return {
    ...(await createLoginSession(user, true)),
    nextPath,
  }
}
