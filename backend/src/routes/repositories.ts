import { Router } from "express"
import { z } from "zod"

import {
  collectGitHubSourceFiles,
  validateGitHubRepository,
} from "../services/github-repository-service"
import { createScanJob } from "../services/scan-workflow-service"
import { sanitizedString } from "../middleware/security"

const repositoryRequestSchema = z.object({
  url: z.string().url(),
  token: z.string().max(500).optional(),
})

const scanRepositorySchema = repositoryRequestSchema.extend({
  requestedLanguage: sanitizedString(1, 50).optional(),
})

export const repositoriesRouter = Router()

repositoriesRouter.post("/validate", async (req, res, next) => {
  try {
    const input = repositoryRequestSchema.parse(req.body)
    const repository = await validateGitHubRepository(input.url, input.token)

    res.json({ success: true, data: repository })
  } catch (error) {
    next(error)
  }
})

repositoriesRouter.post("/files", async (req, res, next) => {
  try {
    const input = repositoryRequestSchema.parse(req.body)
    const repository = await validateGitHubRepository(input.url, input.token)
    const files = await collectGitHubSourceFiles(repository, input.token)

    res.json({ success: true, data: { repository, files } })
  } catch (error) {
    next(error)
  }
})

repositoriesRouter.post("/scan", async (req, res, next) => {
  try {
    const input = scanRepositorySchema.parse(req.body)
    const repository = await validateGitHubRepository(input.url, input.token)
    const files = await collectGitHubSourceFiles(repository, input.token)
    const scan = createScanJob({
      repositoryName: `${repository.owner}/${repository.name}`,
      repositoryUrl: repository.url,
      requestedLanguage: input.requestedLanguage ?? "auto",
      files,
    })

    res.status(202).json({
      success: true,
      data: {
        repository,
        scan,
        filesCollected: files.length,
      },
    })
  } catch (error) {
    next(error)
  }
})
