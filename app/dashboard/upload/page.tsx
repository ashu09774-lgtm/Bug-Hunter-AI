"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  Upload,
  File,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  FileArchive,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type UploadStatus =
  | "idle"
  | "invalid"
  | "uploading"
  | "extracting"
  | "scanning"
  | "complete"
  | "failed"

type ScanJob = {
  id: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  progress: number
  error: string | null
  filesAnalyzed: number
  issuesTotal: number
}

type ApiResponse<T> = {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

type UploadZipResponse = {
  scan: ScanJob
  filesExtracted: number
  storage: {
    provider: "google-drive"
    id: string
    name: string
    webViewLink?: string | null
  } | null
  storageConfigured: boolean
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"

const languages = [
  { value: "auto", label: "Auto-detect" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
]

export default function UploadPage() {
  const router = useRouter()
  const [dragActive, setDragActive] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [language, setLanguage] = React.useState("auto")
  const [status, setStatus] = React.useState<UploadStatus>("idle")
  const [validationError, setValidationError] = React.useState("")
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [extractProgress, setExtractProgress] = React.useState(0)
  const [scanProgress, setScanProgress] = React.useState(0)
  const [scanId, setScanId] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const validateZipFile = async (candidate: File) => {
    if (!candidate.name.toLowerCase().endsWith(".zip")) {
      return "Only .zip files are supported."
    }

    if (candidate.size > 100 * 1024 * 1024) {
      return "ZIP file must be 100MB or smaller."
    }

    if (candidate.size < 4) {
      return "ZIP file appears to be empty or corrupted."
    }

    const signature = new Uint8Array(await candidate.slice(0, 4).arrayBuffer())
    const hasZipSignature =
      signature[0] === 0x50 &&
      signature[1] === 0x4b &&
      (signature[2] === 0x03 ||
        signature[2] === 0x05 ||
        signature[2] === 0x07) &&
      (signature[3] === 0x04 || signature[3] === 0x06 || signature[3] === 0x08)

    return hasZipSignature ? "" : "Invalid ZIP file signature."
  }

  const acceptFile = async (candidate: File) => {
    const error = await validateZipFile(candidate)

    setFile(candidate)
    setValidationError(error)
    setStatus(error ? "invalid" : "idle")

    if (error) {
      toast.error("Invalid ZIP upload", { description: error })
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files?.[0]) {
      acceptFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      acceptFile(e.target.files[0])
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const handleUpload = async () => {
    if (!file) return

    setStatus("uploading")
    setValidationError("")
    setUploadProgress(0)
    setExtractProgress(0)
    setScanProgress(0)
    setScanId("")

    try {
      const formData = new FormData()
      formData.append("archive", file)
      formData.append("repositoryName", file.name.replace(/\.zip$/i, ""))
      formData.append("requestedLanguage", language)

      setUploadProgress(35)

      const response = await fetch(`${apiBaseUrl}/uploads/zip`, {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as ApiResponse<UploadZipResponse>

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to upload this ZIP.")
      }

      setUploadProgress(100)
      setStatus("extracting")
      setExtractProgress(100)

      const createdJob = payload.data.scan
      setScanId(createdJob.id)
      setStatus("scanning")
      setScanProgress(createdJob.progress)

      let currentJob = createdJob
      while (
        currentJob.status === "queued" ||
        currentJob.status === "running"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1200))
        const scanResponse = await fetch(`${apiBaseUrl}/scans/${currentJob.id}`)
        const scanPayload = (await scanResponse.json()) as ApiResponse<ScanJob>

        if (!scanResponse.ok || !scanPayload.success) {
          throw new Error(
            scanPayload.error?.message ?? "Unable to refresh scan status."
          )
        }

        currentJob = scanPayload.data
        setScanProgress(currentJob.progress)
      }

      if (currentJob.status !== "completed") {
        throw new Error(currentJob.error ?? "The scan could not complete.")
      }

      setStatus("complete")
      toast.success("ZIP scan complete", {
        description: `${currentJob.filesAnalyzed} files analyzed and ${currentJob.issuesTotal} issues found.`,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload and scan this ZIP."
      setStatus("failed")
      setValidationError(message)
      toast.error("ZIP upload failed", { description: message })
    }
  }

  const handleReset = () => {
    setFile(null)
    setStatus("idle")
    setValidationError("")
    setUploadProgress(0)
    setExtractProgress(0)
    setScanProgress(0)
    setScanId("")
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload Project
        </h1>
        <p className="text-muted-foreground">
          Upload a ZIP file of your project for AI-powered analysis
        </p>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileArchive className="h-5 w-5" />
            Project Upload
          </CardTitle>
          <CardDescription>
            Drag and drop or click to upload a ZIP file (max 100MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drop Zone */}
          {!file && status === "idle" && (
            <motion.div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                "relative cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all duration-200",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="hidden"
              />
              <motion.div
                animate={
                  dragActive ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }
                }
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-4"
              >
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-200",
                    dragActive ? "bg-primary/10" : "bg-muted"
                  )}
                >
                  <Upload
                    className={cn(
                      "h-6 w-6 transition-colors duration-200",
                      dragActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div>
                  <p className="font-medium">
                    {dragActive
                      ? "Drop your file here"
                      : "Drop your ZIP file here"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to browse
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* File Preview */}
          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-lg border bg-muted/50 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                      {status === "invalid" ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  {(status === "idle" ||
                    status === "invalid" ||
                    status === "failed") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleReset}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {status === "complete" && (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  )}
                </div>
                {validationError && (
                  <p className="mt-3 text-sm text-destructive">
                    {validationError}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Language Select */}
          <div className="space-y-2">
            <Label>Programming Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Progress */}
          <AnimatePresence>
            {(status === "uploading" ||
              status === "extracting" ||
              status === "scanning" ||
              status === "complete") && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                {/* Upload Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      {status === "uploading" && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {(status === "extracting" ||
                        status === "scanning" ||
                        status === "complete") && (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                      Uploading file
                    </span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>

                {/* Scan Progress */}
                {(status === "extracting" ||
                  status === "scanning" ||
                  status === "complete") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        {status === "extracting" && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {(status === "scanning" || status === "complete") && (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                        ZIP extraction
                      </span>
                      <span className="font-medium">{extractProgress}%</span>
                    </div>
                    <Progress value={extractProgress} className="h-1.5" />
                  </div>
                )}

                {(status === "scanning" || status === "complete") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        {status === "scanning" && (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                          >
                            <Sparkles className="h-4 w-4" />
                          </motion.div>
                        )}
                        {status === "complete" && (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                        AI Analysis
                      </span>
                      <span className="font-medium">{scanProgress}%</span>
                    </div>
                    <Progress value={scanProgress} className="h-1.5" />
                    {scanId && (
                      <p className="text-xs text-muted-foreground">
                        Scan ID: {scanId}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {status === "complete" ? (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1"
              >
                <Button
                  onClick={() => router.push("/dashboard/bugs")}
                  className="w-full"
                >
                  View Results
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1"
              >
                <Button
                  className="w-full"
                  disabled={!file || status !== "idle"}
                  onClick={handleUpload}
                >
                  {status === "uploading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : status === "extracting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extracting...
                    </>
                  ) : status === "scanning" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Upload & Scan
                      <Sparkles className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
