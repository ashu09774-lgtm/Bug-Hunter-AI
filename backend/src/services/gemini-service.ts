import { env } from "../config/env"
import { AppError } from "../middleware/error-handler"

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

export type AiReviewRequest = {
  question?: string
  code?: string
  language?: string
  issue?: {
    title?: string
    description?: string
    severity?: string
    filePath?: string
    lineNumber?: number
  }
}

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

type AiUsageMetrics = {
  requests: number
  successes: number
  fallbacks: number
  failures: number
  totalLatencyMs: number
  lastRequestAt: string | null
  lastFallbackAt: string | null
  model: string
}

const geminiEndpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const aiUsageMetrics: AiUsageMetrics = {
  requests: 0,
  successes: 0,
  fallbacks: 0,
  failures: 0,
  totalLatencyMs: 0,
  lastRequestAt: null,
  lastFallbackAt: null,
  model: env.GEMINI_MODEL,
}

function recordAiUsage(
  result: "success" | "fallback" | "failure",
  latencyMs: number
) {
  aiUsageMetrics.requests += 1
  aiUsageMetrics.totalLatencyMs += latencyMs
  aiUsageMetrics.lastRequestAt = new Date().toISOString()

  if (result === "success") {
    aiUsageMetrics.successes += 1
  }

  if (result === "fallback") {
    aiUsageMetrics.fallbacks += 1
    aiUsageMetrics.lastFallbackAt = aiUsageMetrics.lastRequestAt
  }

  if (result === "failure") {
    aiUsageMetrics.failures += 1
  }
}

export function getAiUsageMetrics() {
  return {
    ...aiUsageMetrics,
    averageLatencyMs: aiUsageMetrics.requests
      ? Math.round(aiUsageMetrics.totalLatencyMs / aiUsageMetrics.requests)
      : 0,
    configured: Boolean(env.GEMINI_API_KEY),
  }
}

function buildFallback(input: AiReviewRequest): AiReviewResult {
  const hasCode = Boolean(input.code?.trim())

  return {
    explanation: hasCode
      ? "AI fallback review: inspect input handling, error paths, async behavior, and data validation. The configured Gemini key is missing or unavailable, so this response is deterministic."
      : "AI fallback review: ask a code-specific question or paste a snippet for a deeper debugging pass.",
    suggestedFix: hasCode
      ? `try {\n${input
          .code!.trim()
          .split("\n")
          .map((line) => `  ${line}`)
          .join(
            "\n"
          )}\n} catch (error) {\n  console.error(\"Operation failed\", error)\n  throw error\n}`
      : undefined,
    severity:
      input.issue?.severity?.toLowerCase() === "critical"
        ? "critical"
        : "medium",
    confidence: env.GEMINI_API_KEY ? 0.42 : 0.25,
    optimizations: [
      "Add explicit input validation at trust boundaries.",
      "Prefer small pure helpers for logic that is easy to test.",
      "Log actionable errors without exposing secrets.",
    ],
    summary: hasCode
      ? "Code review fallback generated with baseline safety and maintainability guidance."
      : "General AI assistant fallback generated without code context.",
    model: env.GEMINI_MODEL,
    fallback: true,
  }
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")

  if (start === -1 || end === -1) {
    throw new Error("Gemini response did not include JSON")
  }

  return JSON.parse(candidate.slice(start, end + 1))
}

async function generateText(prompt: string) {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      "GEMINI_API_KEY is not configured",
      503,
      "AI_NOT_CONFIGURED"
    )
  }

  const response = await fetch(geminiEndpoint(env.GEMINI_MODEL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: "application/json",
      },
    }),
  })

  if (!response.ok) {
    throw new AppError(
      "Gemini request failed",
      response.status,
      "GEMINI_REQUEST_FAILED"
    )
  }

  const payload = (await response.json()) as GeminiResponse
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim()

  if (!text) {
    throw new AppError(
      "Gemini returned an empty response",
      502,
      "GEMINI_EMPTY_RESPONSE"
    )
  }

  return text
}

function reviewPrompt(input: AiReviewRequest) {
  return `You are BugHunter AI, a senior debugging assistant. Return strict JSON only with keys: explanation, suggestedFix, severity, confidence, optimizations, summary.

Rules:
- severity must be one of low, medium, high, critical.
- confidence must be a number from 0 to 1.
- optimizations must be an array of concise strings.
- suggestedFix may be an empty string if no code fix is safe.
- Explain vulnerabilities, fixes, and improvements in developer-focused language.

Question:
${input.question ?? "Review this code."}

Issue context:
${JSON.stringify(input.issue ?? {}, null, 2)}

Language:
${input.language ?? "unknown"}

Code:
\`\`\`
${input.code ?? ""}
\`\`\``
}

export async function reviewWithGemini(
  input: AiReviewRequest
): Promise<AiReviewResult> {
  const startedAt = Date.now()

  try {
    const raw = await generateText(reviewPrompt(input))
    const parsed = extractJson(raw)

    const result = {
      explanation: String(parsed.explanation ?? ""),
      suggestedFix: parsed.suggestedFix
        ? String(parsed.suggestedFix)
        : undefined,
      severity: ["low", "medium", "high", "critical"].includes(parsed.severity)
        ? parsed.severity
        : "medium",
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.6))),
      optimizations: Array.isArray(parsed.optimizations)
        ? parsed.optimizations.map(String).slice(0, 6)
        : [],
      summary: String(parsed.summary ?? "AI review complete."),
      model: env.GEMINI_MODEL,
      fallback: false,
    }

    recordAiUsage("success", Date.now() - startedAt)
    return result
  } catch (_error) {
    const result = buildFallback(input)
    recordAiUsage("fallback", Date.now() - startedAt)
    return result
  }
}

export async function chatWithGemini(input: AiReviewRequest) {
  return reviewWithGemini(input)
}
