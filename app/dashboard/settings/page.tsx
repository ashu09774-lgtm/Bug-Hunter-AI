"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  Bell,
  Camera,
  Eye,
  EyeOff,
  Key,
  Monitor,
  Moon,
  Palette,
  Save,
  Sun,
  User,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authClient, type NotificationPreferences } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const defaultNotifications: NotificationPreferences = {
  email: true,
  push: true,
  weekly: false,
  marketing: false,
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSavingProfile, setIsSavingProfile] = React.useState(false)
  const [isSavingPassword, setIsSavingPassword] = React.useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = React.useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [profileForm, setProfileForm] = React.useState({
    username: "",
    email: "",
    bio: "",
    avatarUrl: "",
  })
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: "",
    newPassword: "",
  })
  const [notifications, setNotifications] =
    React.useState<NotificationPreferences>(defaultNotifications)

  React.useEffect(() => {
    authClient
      .profile()
      .then(({ user }) => {
        setProfileForm({
          username: user.username ?? "",
          email: user.email,
          bio: user.bio ?? "",
          avatarUrl: user.avatarUrl ?? "",
        })
        setNotifications(user.notificationPreferences ?? defaultNotifications)
        if (user.theme) {
          setTheme(user.theme)
        }
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Unable to load profile")
      })
      .finally(() => setIsLoading(false))
  }, [setTheme])

  const initials = (profileForm.username || profileForm.email || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const themes = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ]

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSavingProfile(true)

    try {
      const result = await authClient.updateProfile({
        username: profileForm.username,
        bio: profileForm.bio,
        avatarUrl: profileForm.avatarUrl,
      })
      setProfileForm((prev) => ({
        ...prev,
        username: result.user.username ?? prev.username,
        bio: result.user.bio ?? "",
        avatarUrl: result.user.avatarUrl ?? "",
      }))
      toast.success("Profile updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update profile")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSavingPassword(true)

    try {
      await authClient.changePassword(passwordForm)
      setPasswordForm({ currentPassword: "", newPassword: "" })
      toast.success("Password changed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to change password")
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handlePreferencesSubmit = async () => {
    const selectedTheme = (theme === "light" || theme === "dark" || theme === "system")
      ? theme
      : "system"

    setIsSavingPreferences(true)

    try {
      const result = await authClient.updatePreferences({
        theme: selectedTheme,
        notifications,
      })
      setNotifications(result.user.notificationPreferences ?? notifications)
      toast.success("Preferences saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save preferences")
    } finally {
      setIsSavingPreferences(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl space-y-8"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile, password, and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:inline-grid lg:w-auto">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Information</CardTitle>
              <CardDescription>Update your display name, bio, and profile picture</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profileForm.avatarUrl} alt={profileForm.username} />
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="avatarUrl">Profile picture URL</Label>
                    <div className="relative">
                      <Camera className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="avatarUrl"
                        value={profileForm.avatarUrl}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, avatarUrl: event.target.value }))
                        }
                        placeholder="https://example.com/avatar.png"
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Paste a public JPG, PNG, or GIF URL.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={profileForm.username}
                      onChange={(event) =>
                        setProfileForm((prev) => ({ ...prev, username: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={profileForm.email} disabled />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Input
                      id="bio"
                      value={profileForm.bio}
                      onChange={(event) =>
                        setProfileForm((prev) => ({ ...prev, bio: event.target.value }))
                      }
                      maxLength={240}
                      placeholder="Tell your team what you build..."
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSavingProfile}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingProfile ? "Saving..." : "Save profile"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Change Password</CardTitle>
              <CardDescription>Use at least 8 characters for your new password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          currentPassword: event.target.value,
                        }))
                      }
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPassword: event.target.value,
                        }))
                      }
                      minLength={8}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSavingPassword}>
                    {isSavingPassword ? "Changing..." : "Change password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Theme Settings</CardTitle>
              <CardDescription>Select your preferred interface theme</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {themes.map((themeOption) => {
                  const Icon = themeOption.icon
                  const isSelected = theme === themeOption.value

                  return (
                    <button
                      key={themeOption.value}
                      type="button"
                      onClick={() => setTheme(themeOption.value)}
                      className={cn(
                        "flex flex-col items-center gap-3 rounded-lg border p-4 transition-all",
                        isSelected ? "border-primary bg-primary/5" : "bg-muted/40 hover:bg-muted"
                      )}
                    >
                      <Icon className={cn("h-6 w-6", isSelected && "text-primary")} />
                      <span className="text-sm font-medium">{themeOption.label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-end">
                <Button onClick={handlePreferencesSubmit} disabled={isSavingPreferences}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingPreferences ? "Saving..." : "Save theme"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notification Settings</CardTitle>
              <CardDescription>Choose what updates you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                ["email", "Email notifications", "Receive account and scan updates by email"],
                ["push", "Push notifications", "Receive browser notifications"],
                ["weekly", "Weekly digest", "Get a weekly summary of scans and bug trends"],
                ["marketing", "Product updates", "Receive occasional product news"],
              ].map(([key, title, description]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    checked={notifications[key as keyof NotificationPreferences]}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, [key]: checked }))
                    }
                  />
                </div>
              ))}
              <div className="flex justify-end">
                <Button onClick={handlePreferencesSubmit} disabled={isSavingPreferences}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingPreferences ? "Saving..." : "Save notifications"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
