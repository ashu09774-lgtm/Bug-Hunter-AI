import { Readable } from "node:stream"

import { google } from "googleapis"

import { env } from "../config/env"
import { logger } from "../lib/logger"

export type StoredArchive = {
  provider: "google-drive"
  id: string
  name: string
  webViewLink?: string | null
}

export function isGoogleDriveStorageConfigured() {
  return Boolean(
    env.GOOGLE_DRIVE_CLIENT_EMAIL &&
    env.GOOGLE_DRIVE_PRIVATE_KEY &&
    env.GOOGLE_DRIVE_FOLDER_ID
  )
}

function createDriveClient() {
  const auth = new google.auth.JWT({
    email: env.GOOGLE_DRIVE_CLIENT_EMAIL,
    key: env.GOOGLE_DRIVE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  })

  return google.drive({ version: "v3", auth })
}

export async function storeArchiveInGoogleDrive(input: {
  fileName: string
  mimeType: string
  buffer: Buffer
}): Promise<StoredArchive | null> {
  if (!isGoogleDriveStorageConfigured()) {
    return null
  }

  const drive = createDriveClient()

  const response = await drive.files.create({
    requestBody: {
      name: input.fileName,
      parents: [env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType: input.mimeType,
      body: Readable.from(input.buffer),
    },
    fields: "id,name,webViewLink",
  })

  if (!response.data.id || !response.data.name) {
    return null
  }

  return {
    provider: "google-drive",
    id: response.data.id,
    name: response.data.name,
    webViewLink: response.data.webViewLink,
  }
}

export async function deleteExpiredGoogleDriveArchives() {
  if (!isGoogleDriveStorageConfigured()) {
    return 0
  }

  const cutoff = new Date(
    Date.now() - env.GOOGLE_DRIVE_ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  const drive = createDriveClient()
  let pageToken: string | undefined
  let deletedCount = 0

  do {
    const response = await drive.files.list({
      q: [
        `'${env.GOOGLE_DRIVE_FOLDER_ID}' in parents`,
        "trashed = false",
        "mimeType = 'application/zip'",
        `createdTime < '${cutoff}'`,
      ].join(" and "),
      fields: "nextPageToken,files(id,name,createdTime)",
      pageSize: 100,
      pageToken,
    })

    for (const file of response.data.files ?? []) {
      if (!file.id) continue

      await drive.files.delete({ fileId: file.id })
      deletedCount += 1
      logger.info(
        { fileId: file.id, fileName: file.name, createdTime: file.createdTime },
        "Deleted expired Google Drive archive"
      )
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return deletedCount
}
