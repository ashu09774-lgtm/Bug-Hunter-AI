export type DemoRepository = {
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

export const demoRepositories: DemoRepository[] = []
