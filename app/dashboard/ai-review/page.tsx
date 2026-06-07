"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Bot,
  CheckCircle2,
  Code2,
  Copy,
  Loader2,
  RotateCcw,
  Send,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { aiClient, type AiReviewResult } from "@/lib/ai-client"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  code?: string
  result?: AiReviewResult
  timestamp: Date
}

const suggestions = [
  "Explain vulnerabilities in this code",
  "Suggest a safer fix",
  "Classify the severity",
  "Optimize this function",
]

function formatAiResponse(result: AiReviewResult) {
  const lines = [
    result.explanation,
    "",
    `Severity: ${result.severity.toUpperCase()} | Confidence: ${Math.round(
      result.confidence * 100
    )}%`,
  ]

  if (result.optimizations.length > 0) {
    lines.push("", "Improvements:")
    lines.push(...result.optimizations.map((item) => `- ${item}`))
  }

  lines.push("", result.summary)

  if (result.fallback) {
    lines.push("", "Gemini is not configured yet, so this used the local fallback reviewer.")
  }

  return lines.join("\n")
}

export default function AIReviewPage() {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [codeInput, setCodeInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSend = async () => {
    if (!input.trim() && !codeInput.trim()) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input || "Please analyze this code.",
      code: codeInput || undefined,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setCodeInput("")
    setIsLoading(true)

    try {
      const result = await aiClient.review({
        question: userMessage.content,
        code: userMessage.code,
        language: "auto",
      })

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: formatAiResponse(result),
          code: result.suggestedFix,
          result,
          timestamp: new Date(),
        },
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI request failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (id: string, code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    toast.success("Code copied to clipboard")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-[calc(100vh-8rem)] min-h-[620px] flex-col"
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Review</h1>
          <p className="text-muted-foreground">
            Ask Gemini about bugs, vulnerabilities, fixes, and code improvements.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMessages([])}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 font-medium">Start a review</h2>
              <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                Paste code or ask a question. The assistant returns explanations, severity, confidence, and fixes.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary/10">
                          <Bot className="h-4 w-4 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="max-w-[86%] space-y-3">
                      {message.result && (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{message.result.model}</Badge>
                          <Badge variant="outline">{message.result.severity}</Badge>
                          <Badge variant="outline">
                            {Math.round(message.result.confidence * 100)}% confidence
                          </Badge>
                          {message.result.fallback && <Badge variant="destructive">fallback</Badge>}
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-lg px-4 py-3",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                      {message.code && (
                        <div className="space-y-2">
                          <Badge variant="secondary" className="text-xs">
                            <Code2 className="mr-1 h-3 w-3" />
                            Suggested Fix
                          </Badge>
                          <div className="relative overflow-hidden rounded-lg border bg-card">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2 h-7 w-7"
                              onClick={() => handleCopy(message.id, message.code!)}
                            >
                              {copiedId === message.id ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <pre className="max-h-[300px] overflow-x-auto overflow-y-auto p-4 pr-12 font-mono text-sm">
                              <code>{message.code}</code>
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-muted">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoading && (
                  <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Asking Gemini...
                  </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </ScrollArea>
          </div>

        <CardContent className="border-t p-4">
          <div className="space-y-3">
            <Textarea
              placeholder="Paste code here..."
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
              className="min-h-[88px] max-h-[200px] resize-none overflow-y-auto font-mono text-sm"
            />
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask about bugs, security, fixes, or optimization..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[44px] max-h-[120px] resize-none"
                rows={1}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !codeInput.trim())}
                className="h-[44px] w-[44px]"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Press Enter to send, Shift + Enter for a new line.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
