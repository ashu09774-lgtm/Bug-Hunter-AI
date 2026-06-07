import { env } from "./config/env"
import { createApp } from "./app"
import { logger } from "./lib/logger"
import { deleteExpiredGoogleDriveArchives } from "./services/google-drive-storage-service"

const app = createApp()
const archiveCleanupIntervalMs = 24 * 60 * 60 * 1000

async function cleanupExpiredArchives() {
  try {
    const deletedCount = await deleteExpiredGoogleDriveArchives()
    if (deletedCount > 0) {
      logger.info({ deletedCount }, "Expired archive cleanup completed")
    }
  } catch (error) {
    logger.error({ error }, "Expired archive cleanup failed")
  }
}

app.listen(env.API_PORT, () => {
  logger.info(`API server running on http://localhost:${env.API_PORT}`)
  void cleanupExpiredArchives()
})

setInterval(() => {
  void cleanupExpiredArchives()
}, archiveCleanupIntervalMs).unref()
