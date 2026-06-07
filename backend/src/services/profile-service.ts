import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import { AppError } from "../middleware/error-handler"
import { sanitizedString } from "../middleware/security"

export const updateProfileSchema = z.object({
  username: sanitizedString(2, 80),
  bio: sanitizedString(0, 240).optional().nullable(),
  avatarUrl: z.string().url().optional().or(z.literal("")).nullable(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number"),
})

export const updatePreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    weekly: z.boolean(),
    marketing: z.boolean(),
  }),
})

export const userProfileSelect = {
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

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userProfileSelect,
  })

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND")
  }

  return user
}

export async function updateProfile(
  userId: string,
  input: z.infer<typeof updateProfileSchema>
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      username: input.username,
      bio: input.bio || null,
      avatarUrl: input.avatarUrl || null,
    },
    select: userProfileSelect,
  })
}

export async function changePassword(
  userId: string,
  input: z.infer<typeof changePasswordSchema>
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })

  if (!user?.passwordHash) {
    throw new AppError(
      "Password login is not enabled for this account",
      400,
      "PASSWORD_NOT_SET"
    )
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    input.currentPassword,
    user.passwordHash
  )

  if (!isCurrentPasswordValid) {
    throw new AppError(
      "Current password is incorrect",
      400,
      "INVALID_CURRENT_PASSWORD"
    )
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(input.newPassword, 12),
    },
  })
}

export async function updatePreferences(
  userId: string,
  input: z.infer<typeof updatePreferencesSchema>
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      theme: input.theme,
      notificationPreferences: input.notifications,
    },
    select: userProfileSelect,
  })
}
