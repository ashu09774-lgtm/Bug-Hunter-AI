import { config } from "dotenv"
import { z } from "zod"

config({ path: ".env.local" })
config()

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_PORT: z.coerce.number().default(4000),
    API_CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    API_JSON_LIMIT: z.string().default("2mb"),
    API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
    GEMINI_API_KEY: z.string().optional().default(""),
    GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    GOOGLE_CLIENT_ID: z.string().optional().default(""),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
    GOOGLE_DRIVE_CLIENT_EMAIL: z.string().optional().default(""),
    GOOGLE_DRIVE_PRIVATE_KEY: z.string().optional().default(""),
    GOOGLE_DRIVE_FOLDER_ID: z.string().optional().default(""),
    GOOGLE_DRIVE_ARCHIVE_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .default(7),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return

    if (
      value.JWT_SECRET.includes("replace-with") ||
      value.JWT_SECRET.includes("secret")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "JWT_SECRET must be a high-entropy production secret",
      })
    }

    if (!value.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GEMINI_API_KEY"],
        message: "GEMINI_API_KEY is required in production",
      })
    }
  })

export const env = envSchema.parse(process.env)
