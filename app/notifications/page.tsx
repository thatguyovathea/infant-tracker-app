"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Capacitor } from "@capacitor/core"

type Notification = {
  id: string
  type: "feeding" | "sleep" | "diaper" | "family_join"
  title: string
  body: string
  created_at: string
  read_by: string[]
}

const typeEmoji: Record<string, string> = {
  feeding: "🍼",
  sleep: "😴",
  diaper: "💩",
  family_join: "👨‍👩‍👧",
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }
      setUserId(session.user.id)

      const client = await getAuthedClient()
      if (!client) { router.replace("/login"); return }

      const { data: membership } = await client
        .from("family_members").select("family_id")
        .eq("user_id", session.user.id).limit(1).maybeSingle()
      if (!membership) { router.replace("/onboarding"); return }

      const { data } = await client
        .from("notifications")
        .select("id, type, title, body, created_at, read_by")
        .eq("family_id", membership.family_id)
        .order("created_at", { ascending: false })
        .limit(50)

      setNotifications(data ?? [])
      setLoading(false)

      // Mark all unread as read (atomic via RPC)
      const unread = (data ?? []).filter(n => !(n.read_by ?? []).includes(session.user.id))
      if (unread.length > 0) {
        await Promise.all(
          unread.map(n =>
            client.rpc("mark_notification_read", { notification_id: n.id })
              .then(() => {})
              .catch(err => console.error("[notifications] mark read", err))
          )
        )

        // Clear iOS home screen badge
        if (Capacitor.isNativePlatform()) {
          const { PushNotifications } = await import("@capacitor/push-notifications")
          PushNotifications.removeAllDeliveredNotifications().catch(() => {})
        }

        // Reset unread count in dashboard cache so bell clears on return
        try {
          const raw = localStorage.getItem("dash-cache-v3")
          if (raw) {
            const cache = JSON.parse(raw)
            cache.unreadCount = 0
            localStorage.setItem("dash-cache-v3", JSON.stringify(cache))
          }
        } catch { /* ignore */ }
      }
    }
    load().catch(() => setLoading(false))
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3 bg-background" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Notifications</h1>
      </header>

      <main className="max-w-lg mx-auto">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">No notifications yet.</p>
        ) : (
          <div className="divide-y">
            {notifications.map(n => {
              const unread = userId && !(n.read_by ?? []).includes(userId)
              return (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-4 ${unread ? "bg-primary/5" : ""}`}>
                  <span className="text-xl mt-0.5 shrink-0">{typeEmoji[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm ${unread ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                      {unread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
