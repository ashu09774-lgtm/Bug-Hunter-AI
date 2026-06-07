"use client"

import * as React from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { authClient, type AuthUser } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Bell,
  GitBranch,
  Sun,
  Moon,
  LogOut,
  User,
  Settings,
  CreditCard,
  HelpCircle,
  Menu,
} from "lucide-react"

interface NavbarProps {
  sidebarOffset: number
  onMenuClick: () => void
}

export function Navbar({ sidebarOffset, onMenuClick }: NavbarProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [notifications] = React.useState(3)
  const [searchFocused, setSearchFocused] = React.useState(false)
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [quickScanOpen, setQuickScanOpen] = React.useState(false)
  const [quickScanUrl, setQuickScanUrl] = React.useState("")

  React.useEffect(() => {
    authClient
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
  }, [])

  const handleLogout = async () => {
    try {
      await authClient.logout()
      router.push("/login")
    } catch (error) {
      authClient.clearToken()
      toast.error(error instanceof Error ? error.message : "Unable to log out")
      router.push("/login")
    }
  }

  const displayName = user?.username ?? "Developer"
  const displayEmail = user?.email ?? "signed-in user"
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const handleQuickScan = () => {
    setQuickScanOpen(false)
    toast.success("New scan workspace ready", {
      description: quickScanUrl
        ? "Repository URL captured for the scan flow."
        : "Start by choosing a repository source.",
    })
    router.push("/dashboard/scan")
  }

  return (
    <motion.header
      initial={false}
      animate={{ marginLeft: sidebarOffset }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-sm"
    >
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Left side - Mobile menu & Search */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <motion.div
            animate={{ width: searchFocused ? 400 : 280 }}
            transition={{ duration: 0.2 }}
            className="relative hidden xl:block"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search repositories, bugs, reports..."
              className={cn(
                "h-9 pl-9 pr-4 transition-all duration-200",
                searchFocused && "ring-2 ring-ring"
              )}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              Ctrl K
            </kbd>
          </motion.div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          <Dialog open={quickScanOpen} onOpenChange={setQuickScanOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="hidden gap-2 sm:inline-flex">
                <GitBranch className="h-4 w-4" />
                New Scan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Repository Scan</DialogTitle>
                <DialogDescription>
                  Add a GitHub repository URL now, or continue to the scan workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="quick-scan-url">Repository URL</Label>
                <Input
                  id="quick-scan-url"
                  value={quickScanUrl}
                  onChange={(event) => setQuickScanUrl(event.target.value)}
                  placeholder="https://github.com/username/repository"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setQuickScanOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleQuickScan}>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Theme Toggle */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="relative"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </motion.div>

          {/* Notifications */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notifications > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground"
                    >
                      {notifications}
                    </motion.span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Notifications
                  <Badge variant="secondary" className="text-xs">
                    {notifications} new
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[300px] overflow-auto">
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                      <span className="font-medium">Critical bug detected</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      SQL injection vulnerability found in auth.ts
                    </span>
                    <span className="text-xs text-muted-foreground">2 min ago</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-success" />
                      <span className="font-medium">Scan completed</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      my-project repository scan finished
                    </span>
                    <span className="text-xs text-muted-foreground">15 min ago</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-warning" />
                      <span className="font-medium">New team member</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      John Doe joined your workspace
                    </span>
                    <span className="text-xs text-muted-foreground">1 hour ago</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9 transition-transform duration-200 hover:scale-105">
                  <AvatarImage src={user?.avatarUrl ?? "/avatars/user.jpg"} alt={displayName} />
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {displayEmail}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                Help & Support
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  )
}
