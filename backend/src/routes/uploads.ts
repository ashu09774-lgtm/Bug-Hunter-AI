import path from "node:path"

import AdmZip from "adm-zip"
import { Router } from "express"
import multer from "multer"
import { z } from "zod"

import { AppError } from "../middleware/error-handler"
import { safeRelativePath, sanitizedString } from "../middleware/security"
import { createScanJob } from "../services/scan-workflow-service"
import {
  isGoogleDriveStorageConfigured,
  storeArchiveInGoogleDrive,
} from "../services/google-drive-storage-service"

const maxZipBytes = 100 * 1024 * 1024
const maxFilesToScan = 100
const maxFileBytes = 500_000
const maxTotalContentBytes = 5 * 1024 * 1024

const supportedExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
])
const ignoredPathSegments = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxZipBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".zip")) {
      cb(null, true)
      return
    }

    cb(
      new AppError("Only .zip files are supported.", 400, "INVALID_UPLOAD_TYPE")
    )
  },
})

const uploadZipSchema = z.object({
  repositoryName: sanitizedString(1, 200),
  requestedLanguage: sanitizedString(1, 50).optional(),
})

function normalizeZipPath(filePath: string) {
  const withoutDrivePrefix = filePath.replace(/^[a-zA-Z]:/, "")
  const normalized = path.posix
    .normalize(withoutDrivePrefix.replaceAll("\\", "/"))
    .replace(/^\/+/, "")

  const result = safeRelativePath.safeParse(normalized)
  return result.success ? result.data : null
}

function shouldExtractFile(filePath: string) {
  const segments = filePath.split("/")

  if (segments.some((segment) => ignoredPathSegments.has(segment))) {
    return false
  }

  return supportedExtensions.has(path.extname(filePath).toLowerCase())
}

function extractSourceFiles(zipBuffer: Buffer) {
  const zip = new AdmZip(zipBuffer)
  const files = []
  let totalBytes = 0

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue

    const filePath = normalizeZipPath(entry.entryName)
    if (!filePath || !shouldExtractFile(filePath)) continue

    const data = entry.getData()
    if (data.length > maxFileBytes || data.includes(0)) continue

    totalBytes += data.length
    if (totalBytes > maxTotalContentBytes) {
      throw new AppError(
        "Scan payload must be 5MB or smaller after ZIP extraction.",
        413,
        "UPLOAD_TOO_LARGE"
      )
    }

    files.push({
      path: filePath,
      content: data.toString("utf8"),
    })

    if (files.length >= maxFilesToScan) break
  }

  return files
}

export const uploadsRouter = Router()

uploadsRouter.post("/zip", upload.single("archive"), async (req, res, next) => {
  try {
    const file = req.file
    if (!file) {
      throw new AppError("ZIP archive is required.", 400, "UPLOAD_REQUIRED")
    }

    const input = uploadZipSchema.parse({
      repositoryName:
        req.body.repositoryName || file.originalname.replace(/\.zip$/i, ""),
      requestedLanguage: req.body.requestedLanguage || "auto",
    })

    const files = extractSourceFiles(file.buffer)
    if (files.length === 0) {
      throw new AppError(
        "No supported JavaScript, TypeScript, or Python files were found in this ZIP.",
        400,
        "NO_SUPPORTED_FILES"
      )
    }

    const storedArchive = await storeArchiveInGoogleDrive({
      fileName: `${Date.now()}-${file.originalname}`,
      mimeType: file.mimetype || "application/zip",
      buffer: file.buffer,
    })

    const job = createScanJob({
      repositoryName: input.repositoryName,
      repositoryUrl: storedArchive?.webViewLink ?? undefined,
      requestedLanguage: input.requestedLanguage,
      files,
    })

    res.status(202).json({
      success: true,
      data: {
        scan: job,
        filesExtracted: files.length,
        storage: storedArchive,
        storageConfigured: isGoogleDriveStorageConfigured(),
      },
    })
  } catch (error) {
    next(error)
  }
})
