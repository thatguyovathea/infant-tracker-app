"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useColorTheme, COLOR_THEMES } from "@/lib/color-theme"
import { useUnits } from "@/lib/units"
import { useDashboardBg } from "@/lib/dashboard-bg"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { colorTheme, setColorTheme } = useColorTheme()
  const { units, setUnits } = useUnits()
  const { bg, setImage, setOpacity, setBlur } = useDashboardBg()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }

      setEmail(session.user.email ?? "")

      const client = await getAuthedClient()
      if (!client) { router.replace("/login"); return }
      const { data: profile } = await client
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .maybeSingle()

      setDisplayName(profile?.display_name ?? "")
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace("/login"); return }

    const { error } = await client
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("id", session.user.id)

    if (error) { setError(error.message); setSaving(false); return }

    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Clear all cached PII from localStorage
    try {
      localStorage.removeItem("dash-cache-v3")
      localStorage.removeItem("infant-tracker-offline-queue")
      localStorage.removeItem("infant-tracker-quick-prefs")
      localStorage.removeItem("barcode-cache")
      // Remove baby avatar photos
      Object.keys(localStorage)
        .filter(k => k.startsWith("baby-avatar-"))
        .forEach(k => localStorage.removeItem(k))
    } catch { /* localStorage unavailable */ }
    router.replace("/login")
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const client = await getAuthedClient()
      if (!client) { router.replace("/login"); return }
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { router.replace("/login"); return }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || "Failed to delete account")
        setDeleting(false)
        return
      }

      // Clear local data and redirect
      try {
        localStorage.clear()
      } catch { /* ok */ }
      router.replace("/login")
    } catch {
      setError("Failed to delete account. Please try again.")
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3 bg-background" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Settings</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Profile */}
        <form onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} disabled className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={saving || !displayName.trim()}>
                {saved ? "Saved!" : saving ? "Saving..." : "Save changes"}
              </Button>
            </CardFooter>
          </Card>
        </form>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "light", label: "☀️ Light" },
                { value: "dim",   label: "◑ Dim"   },
                { value: "dark",  label: "🌙 Dark"  },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    theme === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Units */}
        <Card>
          <CardHeader>
            <CardTitle>Measurement units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "metric", label: "Metric", sub: "kg, cm" },
                { value: "imperial", label: "Imperial", sub: "lbs, in" },
              ] as const).map(opt => (
                <button key={opt.value} type="button" onClick={() => setUnits(opt.value)}
                  className={`py-3 px-3 rounded-lg border text-sm font-medium transition-colors text-left ${units === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}>
                  <p>{opt.label}</p>
                  <p className={`text-xs mt-0.5 ${units === opt.value ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{opt.sub}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dashboard background */}
        <Card>
          <CardHeader>
            <CardTitle>Dashboard background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bg.image ? (
              <div className="relative rounded-xl overflow-hidden h-28">
                <img src={bg.image} alt="Background preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-background/70" />
                <button
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-md font-medium">
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                <span className="text-2xl mb-1">🖼️</span>
                <span>Tap to choose a photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = ev => setImage(ev.target?.result as string)
                    reader.readAsDataURL(file)
                  }}
                />
              </label>
            )}

            {bg.image && (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <Label>Visibility</Label>
                    <span className="text-muted-foreground">{Math.round(bg.opacity * 100)}%</span>
                  </div>
                  <input type="range" min="5" max="45" step="5"
                    value={Math.round(bg.opacity * 100)}
                    onChange={e => setOpacity(parseInt(e.target.value) / 100)}
                    className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtle</span><span>Visible</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <Label>Blur</Label>
                    <span className="text-muted-foreground">{bg.blur}px</span>
                  </div>
                  <input type="range" min="0" max="12" step="2"
                    value={bg.blur}
                    onChange={e => setBlur(parseInt(e.target.value))}
                    className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Sharp</span><span>Blurred</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Color palette */}
        <Card>
          <CardHeader>
            <CardTitle>Color palette</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {COLOR_THEMES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setColorTheme(t.value)}
                  className={`flex items-center gap-2 flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    colorTheme === t.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0 border border-black/10"
                    style={{ background: t.preview }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Account actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-0">
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-sm hover:bg-muted/50 transition-colors"
              onClick={() => router.push("/settings/defaults")}
            >
              <span>Quick log defaults</span>
              <span className="text-muted-foreground">→</span>
            </button>
            <Separator />
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-sm hover:bg-muted/50 transition-colors"
              onClick={() => router.push("/family")}
            >
              <span>Family &amp; invite code</span>
              <span className="text-muted-foreground">→</span>
            </button>
            <Separator />
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-sm hover:bg-muted/50 transition-colors"
              onClick={() => router.push("/export")}
            >
              <span>Export data</span>
              <span className="text-muted-foreground">→</span>
            </button>
            <Separator />
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-sm text-destructive hover:bg-destructive/5 transition-colors"
              onClick={handleSignOut}
            >
              <span>Sign out</span>
              <span>→</span>
            </button>
            <Separator />
            {!confirmDelete ? (
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-sm text-destructive/70 hover:bg-destructive/5 transition-colors"
                onClick={() => setConfirmDelete(true)}
              >
                <span>Delete account</span>
                <span>→</span>
              </button>
            ) : (
              <div className="px-6 py-4 space-y-3">
                <p className="text-sm text-destructive font-medium">This will permanently delete your account, remove you from all families, and erase all your data. This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
                  <Button variant="destructive" className="flex-1" size="sm" onClick={handleDeleteAccount} disabled={deleting}>
                    {deleting ? "Deleting..." : "Yes, delete"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  )
}
