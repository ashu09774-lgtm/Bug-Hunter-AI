"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  ExternalLink,
  GitBranch,
  Lock,
  Search,
  Star,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/layout/page-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { type DemoRepository } from "@/lib/demo-repositories"

type RepositoryInfo = DemoRepository

const storageKey = "bughunter.repositories"

export default function RepositoriesPage() {
  const [repositories, setRepositories] = React.useState<RepositoryInfo[]>([])
  const [query, setQuery] = React.useState("")

  React.useEffect(() => {
    setRepositories(JSON.parse(localStorage.getItem(storageKey) ?? "[]"))
  }, [])

  const filteredRepositories = repositories.filter((repository) => {
    const searchable = `${repository.owner}/${repository.name} ${repository.language ?? ""}`
    return searchable.toLowerCase().includes(query.toLowerCase())
  })

  const deleteRepository = (id: number) => {
    const next = repositories.filter((repository) => repository.id !== id)
    setRepositories(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
    toast.success("Repository removed", {
      description:
        "Temporary repository metadata was deleted from this workspace.",
    })
  }



  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Repositories
          </h1>
          <p className="text-muted-foreground">
            Manage validated repositories before scanning and reporting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/dashboard/scan">
              <GitBranch className="mr-2 h-4 w-4" />
              New Scan
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search repositories..."
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {filteredRepositories.length === 0 ? (
        <EmptyState
          title={
            repositories.length === 0
              ? "No repositories yet"
              : "No repositories found"
          }
          description={
            repositories.length === 0
              ? "Validate a GitHub URL from New Scan to add it here."
              : "Try a different repository name, owner, or language."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredRepositories.map((repository, index) => (
            <motion.div
              key={repository.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {repository.isPrivate ? (
                          <Lock className="h-5 w-5" />
                        ) : (
                          <GitBranch className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {repository.owner}/{repository.name}
                        </CardTitle>
                        <CardDescription>
                          Branch: {repository.defaultBranch}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={repository.isPrivate ? "destructive" : "outline"}
                    >
                      {repository.isPrivate ? "Private" : "Public"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {repository.language ?? "Unknown"}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Star className="h-3 w-3" />
                      {repository.stars}
                    </Badge>
                    <Badge variant="outline">
                      {repository.openIssues} open issues
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={repository.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteRepository(repository.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
