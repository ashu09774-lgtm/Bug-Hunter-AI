export type AuthUser = {
  id: string
  email: string
  username: string | null
  bio?: string | null
  avatarUrl: string | null
  theme?: "light" | "dark" | "system"
  notificationPreferences?: NotificationPreferences | null
  emailVerifiedAt: string | null
  createdAt?: string
}

export type NotificationPreferences = {
  email: boolean
  push: boolean
  weekly: boolean
  marketing: boolean
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

async function request<T>(path: string, init?: RequestInit) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null

  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
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
    throw new Error(payload.error?.message ?? "Request failed")
  }

  return payload.data as T
}

export const authClient = {
  saveToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token)
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY)
  },

  async signup(input: { username: string; email: string; password: string }) {
    return request<{ user: AuthUser; emailVerificationToken?: string }>(
      "/auth/signup",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    )
  },

  async login(input: { email: string; password: string; rememberMe: boolean }) {
    const result = await request<{
      token: string
      user: AuthUser
      expiresAt: string
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    })

    authClient.saveToken(result.token)
    return result
  },

  async startGoogleOAuth(nextPath = "/dashboard") {
    const result = await request<{ url: string }>(
      `/auth/google/url?next=${encodeURIComponent(nextPath)}`
    )
    window.location.assign(result.url)
  },

  async me() {
    return request<{ user: AuthUser }>("/auth/me")
  },

  async logout() {
    await request("/auth/logout", {
      method: "POST",
    })
    authClient.clearToken()
  },

  async forgotPassword(email: string) {
    return request<{ message: string; resetToken?: string }>(
      "/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      }
    )
  },

  async resetPassword(input: { token: string; password: string }) {
    return request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async verifyEmail(token: string) {
    return request("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
  },

  async profile() {
    return request<{ user: AuthUser }>("/profile/me")
  },

  async updateProfile(input: {
    username: string
    bio?: string | null
    avatarUrl?: string | null
  }) {
    return request<{ user: AuthUser }>("/profile/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  },

  async changePassword(input: {
    currentPassword: string
    newPassword: string
  }) {
    return request("/profile/change-password", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async updatePreferences(input: {
    theme: "light" | "dark" | "system"
    notifications: NotificationPreferences
  }) {
    return request<{ user: AuthUser }>("/profile/preferences", {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  },
}
