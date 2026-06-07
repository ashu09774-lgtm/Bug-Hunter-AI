import { AppError } from "../middleware/error-handler"

export type RepositoryInfo = {
  id: number
  name: string
  owner: string
  url: string
  defaultBranch: string
  language: string | null
  isPrivate: boolean
  stars: number
  openIssues: number
  updatedAt: string
}

export type SourceFile = {
  path: string
  content: string
}

type GitHubTreeItem = {
  path: string
  type: "blob" | "tree"
  size?: number
  url: string
}

const maxFilesToScan = 60
const maxFileSize = 250_000
const supportedExtensions = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".py"]
const ignoredSegments = new Set([
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

export function parseGitHubUrl(url: string) {
  const match = url
    .trim()
    .match(/^https?:\/\/github\.com\/([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/i)

  if (!match) return null

  return {
    owner: match[1],
    repo: match[2],
  }
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-bug-detection",
  }

  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`
  }

  return headers
}

async function requestGitHubJson<T>(url: string, token?: string) {
  const response = await fetch(url, { headers: githubHeaders(token) })

  if (response.status === 404) {
    throw new AppError(
      "Repository was not found or your token cannot access it.",
      404,
      "GITHUB_REPOSITORY_NOT_FOUND"
    )
  }

  if (response.status === 403) {
    throw new AppError(
      "GitHub rate limit or private repository access blocked this request.",
      403,
      "GITHUB_ACCESS_BLOCKED"
    )
  }

  if (!response.ok) {
    throw new AppError(
      "GitHub could not complete this repository request.",
      response.status,
      "GITHUB_REQUEST_FAILED"
    )
  }

  return (await response.json()) as T
}

function isSupportedSourceFile(item: GitHubTreeItem) {
  if (item.type !== "blob") return false
  if (item.size && item.size > maxFileSize) return false

  const pathSegments = item.path.split("/")
  if (pathSegments.some((segment) => ignoredSegments.has(segment))) return false

  return supportedExtensions.some((extension) =>
    item.path.toLowerCase().endsWith(extension)
  )
}

export async function validateGitHubRepository(url: string, token?: string) {
  const parsed = parseGitHubUrl(url)
  if (!parsed) {
    throw new AppError(
      "Use a GitHub URL like https://github.com/owner/repository",
      400,
      "INVALID_GITHUB_URL"
    )
  }

  const payload = await requestGitHubJson<{
    id: number
    name: string
    owner?: { login?: string }
    html_url: string
    default_branch?: string
    language: string | null
    private?: boolean
    stargazers_count?: number
    open_issues_count?: number
    updated_at: string
  }>(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, token)

  return {
    id: payload.id,
    name: payload.name,
    owner: payload.owner?.login ?? parsed.owner,
    url: payload.html_url,
    defaultBranch: payload.default_branch ?? "main",
    language: payload.language,
    isPrivate: Boolean(payload.private),
    stars: payload.stargazers_count ?? 0,
    openIssues: payload.open_issues_count ?? 0,
    updatedAt: payload.updated_at,
  } satisfies RepositoryInfo
}

export async function collectGitHubSourceFiles(
  repository: RepositoryInfo,
  token?: string
) {
  const treePayload = await requestGitHubJson<{ tree?: GitHubTreeItem[] }>(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/git/trees/${repository.defaultBranch}?recursive=1`,
    token
  )

  const candidates = (treePayload.tree ?? [])
    .filter(isSupportedSourceFile)
    .slice(0, maxFilesToScan)

  if (candidates.length === 0) {
    throw new AppError(
      "No supported JavaScript, TypeScript, or Python files were found.",
      400,
      "NO_SUPPORTED_FILES"
    )
  }

  const files: SourceFile[] = []

  for (const item of candidates) {
    const blobPayload = await requestGitHubJson<{
      encoding?: string
      content?: string
    }>(item.url, token)

    if (
      blobPayload.encoding !== "base64" ||
      typeof blobPayload.content !== "string"
    ) {
      continue
    }

    files.push({
      path: item.path,
      content: Buffer.from(
        blobPayload.content.replace(/\s/g, ""),
        "base64"
      ).toString("utf8"),
    })
  }

  if (files.length === 0) {
    throw new AppError(
      "GitHub returned source file entries, but none could be downloaded.",
      502,
      "GITHUB_FILES_UNAVAILABLE"
    )
  }

  return files
}
