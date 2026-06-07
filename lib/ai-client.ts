export type AiReviewResult = {
  explanation: string
  suggestedFix?: string
  severity: "low" | "medium" | "high" | "critical"
  confidence: number
  optimizations: string[]
  summary: string
  model: string
  fallback: boolean
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"
const TOKEN_KEY = "bughunter.auth_token"

async function request<T>(path: string, body: unknown) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null

  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(
      "Backend API is not reachable. Start it with npm run backend:dev and check NEXT_PUBLIC_API_URL."
    )
  }

  const payload = (await response.json().catch(() => ({
    success: response.ok,
    error: {
      code: "INVALID_RESPONSE",
      message: "Server returned an invalid response",
    },
  }))) as ApiResponse<T>

  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message ?? "AI request failed")
  }

  return payload.data as T
}

export const aiClient = {
  review(input: { question?: string; code?: string; language?: string }) {
    return request<AiReviewResult>("/ai/review", input)
  },

  chat(input: { question?: string; code?: string; language?: string }) {
    return request<AiReviewResult>("/ai/chat", input)
  },
}
