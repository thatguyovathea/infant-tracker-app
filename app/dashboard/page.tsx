"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatDistanceToNow, differenceInMinutes, format } from "date-fns"
import { Settings, TrendingUp, Bell } from "lucide-react"
import { useDashboardBg } from "@/lib/dashboard-bg"

function GroupIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      {/* Left person */}
      <circle cx="4.5" cy="9" r="2" />
      <path d="M1 21v-1a4 4 0 0 1 4-4h.5" />
      {/* Right person */}
      <circle cx="19.5" cy="9" r="2" />
      <path d="M23 21v-1a4 4 0 0 0-4-4h-.5" />
      {/* Center person (front) */}
      <circle cx="12" cy="7" r="3" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  )
}
import { registerPushNotifications } from "@/lib/push-notifications"
import { enqueue, readQueue, removeFromQueue, type QueuedItem } from "@/lib/offline-queue"

const PREFS_KEY = "infant-tracker-quick-prefs"

type QuickPrefs = {
  feeding: { type: string; side: string; amount_ml: string; food_name: string }
  diaper: { type: string }
}

const DEFAULT_PREFS: QuickPrefs = {
  feeding: { type: "breast", side: "left", amount_ml: "", food_name: "" },
  diaper: { type: "wet" },
}

function loadLocalPrefs(): QuickPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
  } catch { return DEFAULT_PREFS }
}

function saveLocalPrefs(prefs: QuickPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

async function loadRemotePrefs(client: ReturnType<typeof import("@supabase/supabase-js").createClient>, userId: string): Promise<QuickPrefs | null> {
  const { data } = await client.from("user_preferences").select("quick_prefs").eq("user_id", userId).maybeSingle()
  if (!data?.quick_prefs) return null
  return { ...DEFAULT_PREFS, ...data.quick_prefs }
}

async function saveRemotePrefs(client: ReturnType<typeof import("@supabase/supabase-js").createClient>, userId: string, prefs: QuickPrefs) {
  await client.from("user_preferences").upsert({ user_id: userId, quick_prefs: prefs, updated_at: new Date().toISOString() })
}

type Baby = { id: string; name: string }

type ActivityItem = {
  id: string
  type: "feeding" | "sleep" | "diaper"
  label: string
  timestamp: string
  babyId: string
}

type ActiveSleep = { id: string; babyId: string; startedAt: string }

type DailySummary = {
  babyId: string
  feedings: number
  sleepMinutes: number
  diapers: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TodayLogs = { feedings: any[]; sleeps: any[]; diapers: any[] }

function feedingLabel(row: Record<string, string>): string {
  if (row.type === "breast") return `Breastfed · ${row.side ?? ""} side`
  if (row.type === "bottle") return row.amount_ml ? `Bottle · ${row.amount_ml}ml` : "Bottle feeding"
  if (row.type === "solid") return `Solids${row.food_name ? ` · ${row.food_name}` : ""}`
  return "Feeding"
}

function sleepLabel(row: Record<string, string>): string {
  if (row.ended_at) {
    const mins = Math.round((new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 60000)
    return `Slept · ${mins} min`
  }
  return "Sleep started"
}

function diaperLabel(row: Record<string, string>): string {
  const map: Record<string, string> = { wet: "Wet diaper", dirty: "Dirty diaper", both: "Wet & dirty", dry: "Dry diaper" }
  return map[row.type] ?? "Diaper change"
}

function feedingPresetLabel(prefs: QuickPrefs["feeding"]): string {
  if (prefs.type === "breast") return `Breast · ${prefs.side} side`
  if (prefs.type === "bottle") return prefs.amount_ml ? `Bottle · ${prefs.amount_ml}ml` : "Bottle"
  if (prefs.type === "solid") return prefs.food_name ? `Solids · ${prefs.food_name}` : "Solids"
  return "Feeding"
}

function diaperPresetLabel(prefs: QuickPrefs["diaper"]): string {
  const map: Record<string, string> = { wet: "Wet", dirty: "Dirty", both: "Wet & dirty", dry: "Dry" }
  return map[prefs.type] ?? "Diaper"
}

const typeColors: Record<string, string> = {
  feeding: "bg-teal-400/40 border-teal-400/60 text-teal-800 dark:text-teal-200 backdrop-blur-sm",
  sleep:   "bg-violet-400/40 border-violet-400/60 text-violet-800 dark:text-violet-200 backdrop-blur-sm",
  diaper:  "bg-rose-400/40 border-rose-400/60 text-rose-800 dark:text-rose-200 backdrop-blur-sm",
}

const summaryGlass: Record<string, string> = {
  feeding: "bg-teal-400/40 border border-teal-400/60 backdrop-blur-md shadow-sm",
  sleep:   "bg-violet-400/40 border border-violet-400/60 backdrop-blur-md shadow-sm",
  diaper:  "bg-rose-400/40 border border-rose-400/60 backdrop-blur-md shadow-sm",
}

export default function DashboardPage() {
  const router = useRouter()
  const [babies, setBabies] = useState<Baby[]>([])
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activeSleep, setActiveSleep] = useState<ActiveSleep | null>(null)
  const [sleepElapsed, setSleepElapsed] = useState("")
  const [prefs, setPrefs] = useState<QuickPrefs>(DEFAULT_PREFS)
  const [summaries, setSummaries] = useState<DailySummary[]>([])
  const [todayLogs, setTodayLogs] = useState<TodayLogs>({ feedings: [], sleeps: [], diapers: [] })
  const [sheet, setSheet] = useState<{ type: "feeding" | "sleep" | "diaper"; babyId: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Baby picker state: which log type is waiting for baby selection
  const [picking, setPicking] = useState<"feeding" | "sleep" | "diaper" | null>(null)
  const [logging, setLogging] = useState<"feeding" | "sleep" | "diaper" | null>(null)
  const [flashSuccess, setFlashSuccess] = useState<"feeding" | "sleep" | "diaper" | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [displayName, setDisplayName] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const { bg } = useDashboardBg()


  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }

      const client = await getAuthedClient()
      if (!client) { router.replace("/login"); return }

      const { data: membership } = await client
        .from("family_members").select("family_id")
        .eq("user_id", session.user.id).limit(1).maybeSingle()
      if (!membership) { router.replace("/onboarding"); return }

      const fid = membership.family_id
      setFamilyId(fid)
      setUserId(session.user.id)

      // Fetch display name
      const { data: profile } = await client.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle()
      setDisplayName(profile?.display_name ?? "Someone")

      // Fetch unread notification count
      const { data: notifs } = await client
        .from("notifications").select("id, read_by")
        .eq("family_id", fid)
      const unread = (notifs ?? []).filter(n => !n.read_by.includes(session.user.id))
      setUnreadCount(unread.length)

      const [{ data: babiesData }, { data: feedings }, { data: sleeps }, { data: diapers }, { data: openSleep }] =
        await Promise.all([
          client.from("babies").select("id, name").eq("family_id", fid).order("created_at"),
          client.from("feeding_logs").select("*").eq("family_id", fid).order("started_at", { ascending: false }).limit(15),
          client.from("sleep_logs").select("*").eq("family_id", fid).order("started_at", { ascending: false }).limit(15),
          client.from("diaper_logs").select("*").eq("family_id", fid).order("logged_at", { ascending: false }).limit(15),
          client.from("sleep_logs").select("id, baby_id, started_at").eq("family_id", fid).is("ended_at", null).order("started_at", { ascending: false }).limit(1),
        ])

      setBabies(babiesData ?? [])

      // Today's summary
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayISO = todayStart.toISOString()
      const [{ data: todayFeedings }, { data: todaySleeps }, { data: todayDiapers }] = await Promise.all([
        client.from("feeding_logs").select("*").eq("family_id", fid).gte("started_at", todayISO).order("started_at", { ascending: false }),
        client.from("sleep_logs").select("*").eq("family_id", fid).gte("started_at", todayISO).order("started_at", { ascending: false }),
        client.from("diaper_logs").select("*").eq("family_id", fid).gte("logged_at", todayISO).order("logged_at", { ascending: false }),
      ])
      setTodayLogs({ feedings: todayFeedings ?? [], sleeps: todaySleeps ?? [], diapers: todayDiapers ?? [] })
      const summaryMap: Record<string, DailySummary> = {}
      babiesData?.forEach(b => { summaryMap[b.id] = { babyId: b.id, feedings: 0, sleepMinutes: 0, diapers: 0 } })
      todayFeedings?.forEach(f => { if (summaryMap[f.baby_id]) summaryMap[f.baby_id].feedings++ })
      todayDiapers?.forEach(d => { if (summaryMap[d.baby_id]) summaryMap[d.baby_id].diapers++ })
      todaySleeps?.forEach(s => {
        if (!summaryMap[s.baby_id]) return
        const start = new Date(s.started_at)
        const end = s.ended_at ? new Date(s.ended_at) : new Date()
        summaryMap[s.baby_id].sleepMinutes += Math.round((end.getTime() - start.getTime()) / 60000)
      })
      setSummaries(Object.values(summaryMap))

      if (openSleep && openSleep.length > 0) {
        setActiveSleep({ id: openSleep[0].id, babyId: openSleep[0].baby_id, startedAt: openSleep[0].started_at })
      }

      // Load prefs: try remote first, fall back to local
      const authedClient = await getAuthedClient()
      const remote = authedClient ? await loadRemotePrefs(authedClient, session.user.id) : null
      const stored = remote ?? loadLocalPrefs()

      // Learn from last logs
      if (feedings && feedings.length > 0) {
        const last = feedings[0]
        stored.feeding = {
          type: last.type ?? stored.feeding.type,
          side: last.side ?? stored.feeding.side,
          amount_ml: last.amount_ml ? String(last.amount_ml) : stored.feeding.amount_ml,
          food_name: last.food_name ?? stored.feeding.food_name,
        }
      }
      if (diapers && diapers.length > 0) {
        stored.diaper.type = diapers[0].type ?? stored.diaper.type
      }
      setPrefs(stored)
      saveLocalPrefs(stored)
      if (authedClient) saveRemotePrefs(authedClient, session.user.id, stored)

      const items: ActivityItem[] = [
        ...(feedings ?? []).map(r => ({ id: r.id, type: "feeding" as const, label: feedingLabel(r), timestamp: r.started_at, babyId: r.baby_id })),
        ...(sleeps ?? []).map(r => ({ id: r.id, type: "sleep" as const, label: sleepLabel(r), timestamp: r.started_at, babyId: r.baby_id })),
        ...(diapers ?? []).map(r => ({ id: r.id, type: "diaper" as const, label: diaperLabel(r), timestamp: r.logged_at, babyId: r.baby_id })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15)

      setActivity(items)
      setLoading(false)
      setPendingCount(readQueue().length)
      registerPushNotifications()
    }
    load()

    // Realtime: bump unread count when a new notification arrives
    const supabase = createClient()
    const channel = supabase.channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()

    // Sync offline queue when connectivity returns
    async function syncQueue() {
      const queue = readQueue()
      if (!queue.length) return
      const client = await getAuthedClient()
      if (!client) return
      for (const item of queue) {
        try {
          if (item.operation === "insert") {
            const { error } = await client.from(item.table).insert(item.data)
            if (error) continue
          } else if (item.operation === "update") {
            const { error } = await client.from(item.table).update(item.data).eq("id", item.rowId)
            if (error) continue
          }
          if (item.notification) {
            await client.from("notifications").insert(item.notification)
          }
          removeFromQueue(item.id)
        } catch { /* leave in queue, try next time */ }
      }
      setPendingCount(readQueue().length)
    }
    window.addEventListener("online", syncQueue)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener("online", syncQueue)
    }
  }, [router])

  // Tick active sleep timer
  useEffect(() => {
    if (!activeSleep) return
    function tick() {
      const mins = differenceInMinutes(new Date(), new Date(activeSleep!.startedAt))
      const h = Math.floor(mins / 60)
      const m = mins % 60
      setSleepElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [activeSleep])

  const babyMap = useMemo(() => Object.fromEntries(babies.map(b => [b.id, b.name])), [babies])

  const lastByType = useMemo(() => {
    const result: Record<string, Date | null> = { feeding: null, sleep: null, diaper: null }
    for (const item of activity) {
      if (!result[item.type]) result[item.type] = new Date(item.timestamp)
    }
    return result
  }, [activity])

  const doLog = useCallback(async (type: "feeding" | "sleep" | "diaper", babyId: string) => {
    if (!familyId) return
    setLogging(type)

    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { data: { session } } = await createClient().auth.getSession()
    const logUserId = session?.user.id ?? userId
    const babyName = babyMap[babyId] ?? "baby"
    const actor = displayName || "Someone"
    const offline = !navigator.onLine

    if (type === "feeding") {
      const p = prefs.feeding
      const feedData = {
        baby_id: babyId, family_id: familyId, logged_by: logUserId,
        type: p.type,
        side: p.type === "breast" ? p.side : null,
        amount_ml: p.type === "bottle" && p.amount_ml ? parseFloat(p.amount_ml) : null,
        food_name: p.type === "solid" && p.food_name ? p.food_name : null,
        started_at: new Date().toISOString(),
      }
      const notifData = {
        family_id: familyId, actor_id: logUserId, type: "feeding",
        title: `${actor} logged a feeding`,
        body: `${feedingPresetLabel(p)} for ${babyName}`,
      }
      const newItem: ActivityItem = { id: crypto.randomUUID(), type: "feeding", label: feedingPresetLabel(p), timestamp: feedData.started_at, babyId }
      setActivity(prev => [newItem, ...prev].slice(0, 15))

      if (offline) {
        enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "insert", table: "feeding_logs", data: feedData, notification: notifData })
        setPendingCount(c => c + 1)
      } else {
        try {
          const { data: feedRow } = await client.from("feeding_logs").insert(feedData).select("id").single()
          await client.from("notifications").insert({ ...notifData, reference_id: feedRow?.id ?? null })
        } catch {
          enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "insert", table: "feeding_logs", data: feedData, notification: notifData })
          setPendingCount(c => c + 1)
        }
      }
    }

    if (type === "diaper") {
      const p = prefs.diaper
      const labelMap: Record<string, string> = { wet: "Wet diaper", dirty: "Dirty diaper", both: "Wet & dirty", dry: "Dry diaper" }
      const diaperData = {
        baby_id: babyId, family_id: familyId, logged_by: logUserId,
        type: p.type, logged_at: new Date().toISOString(),
      }
      const notifData = {
        family_id: familyId, actor_id: logUserId, type: "diaper",
        title: `${actor} logged a diaper change`,
        body: `${labelMap[p.type]} for ${babyName}`,
      }
      const newItem: ActivityItem = { id: crypto.randomUUID(), type: "diaper", label: labelMap[p.type], timestamp: diaperData.logged_at, babyId }
      setActivity(prev => [newItem, ...prev].slice(0, 15))

      if (offline) {
        enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "insert", table: "diaper_logs", data: diaperData, notification: notifData })
        setPendingCount(c => c + 1)
      } else {
        try {
          const { data: diaperRow } = await client.from("diaper_logs").insert(diaperData).select("id").single()
          await client.from("notifications").insert({ ...notifData, reference_id: diaperRow?.id ?? null })
        } catch {
          enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "insert", table: "diaper_logs", data: diaperData, notification: notifData })
          setPendingCount(c => c + 1)
        }
      }
    }

    if (type === "sleep") {
      if (activeSleep) {
        const endedAt = new Date().toISOString()
        const mins = differenceInMinutes(new Date(), new Date(activeSleep.startedAt))
        const h = Math.floor(mins / 60), m = mins % 60
        const durationStr = h > 0 ? `${h}h ${m}m` : `${m} min`
        const notifData = {
          family_id: familyId, actor_id: logUserId, type: "sleep",
          title: `${actor} ended sleep`,
          body: `${babyName} slept for ${durationStr}`,
        }
        const newItem: ActivityItem = { id: activeSleep.id, type: "sleep", label: `Slept · ${durationStr}`, timestamp: activeSleep.startedAt, babyId }
        setActivity(prev => [newItem, ...prev.filter(i => i.id !== activeSleep.id)].slice(0, 15))
        setActiveSleep(null)
        setSleepElapsed("")

        if (offline) {
          enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "update", table: "sleep_logs", rowId: activeSleep.id, data: { ended_at: endedAt }, notification: notifData })
          setPendingCount(c => c + 1)
        } else {
          try {
            await client.from("sleep_logs").update({ ended_at: endedAt }).eq("id", activeSleep.id)
            await client.from("notifications").insert({ ...notifData, reference_id: activeSleep.id })
          } catch {
            enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "update", table: "sleep_logs", rowId: activeSleep.id, data: { ended_at: endedAt }, notification: notifData })
            setPendingCount(c => c + 1)
          }
        }
      } else {
        const startedAt = new Date().toISOString()
        const sleepData = {
          baby_id: babyId, family_id: familyId, logged_by: logUserId,
          started_at: startedAt,
        }
        const notifData = {
          family_id: familyId, actor_id: logUserId, type: "sleep",
          title: `${actor} started sleep`,
          body: `${babyName} is now sleeping`,
        }

        if (offline) {
          const localId = crypto.randomUUID()
          setActiveSleep({ id: localId, babyId, startedAt })
          const newItem: ActivityItem = { id: localId, type: "sleep", label: "Sleep started", timestamp: startedAt, babyId }
          setActivity(prev => [newItem, ...prev].slice(0, 15))
          enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "insert", table: "sleep_logs", data: sleepData, notification: notifData })
          setPendingCount(c => c + 1)
        } else {
          try {
            const { data } = await client.from("sleep_logs").insert(sleepData).select().single()
            if (data) {
              setActiveSleep({ id: data.id, babyId, startedAt: data.started_at })
              const newItem: ActivityItem = { id: data.id, type: "sleep", label: "Sleep started", timestamp: data.started_at, babyId }
              setActivity(prev => [newItem, ...prev].slice(0, 15))
              await client.from("notifications").insert({ ...notifData, reference_id: data.id })
            }
          } catch {
            const localId = crypto.randomUUID()
            setActiveSleep({ id: localId, babyId, startedAt })
            const newItem: ActivityItem = { id: localId, type: "sleep", label: "Sleep started", timestamp: startedAt, babyId }
            setActivity(prev => [newItem, ...prev].slice(0, 15))
            enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "insert", table: "sleep_logs", data: sleepData, notification: notifData })
            setPendingCount(c => c + 1)
          }
        }
      }
    }

    // Persist updated prefs
    const { data: { session: s } } = await createClient().auth.getSession()
    if (s) {
      saveLocalPrefs(prefs)
      saveRemotePrefs(client, s.user.id, prefs)
    }

    setLogging(null)
    setFlashSuccess(type)
    setTimeout(() => setFlashSuccess(null), 1500)
  }, [familyId, prefs, activeSleep, router, displayName, babyMap, userId])

  function handleTap(type: "feeding" | "sleep" | "diaper") {
    if (babies.length === 0) return
    if (babies.length === 1) {
      doLog(type, babies[0].id)
    } else {
      setPicking(type)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  )

  const multipleBabies = babies.length > 1
  const dotColors: Record<string, string> = {
    feeding: "bg-teal-400",
    sleep: "bg-violet-400",
    diaper: "bg-rose-400",
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">

      {/* Background photo */}
      {bg.image && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={bg.image}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: bg.opacity, filter: `blur(${bg.blur}px)`, transform: "scale(1.05)" }}
          />
        </div>
      )}

      {/* Header */}
      <header className="px-5 pt-5 pb-2 flex items-center justify-between max-w-lg mx-auto w-full">
        <h1 className="text-3xl font-bold leading-tight">
          {babies.length === 0 ? "Add a baby" : babies.map(b => b.name).join(" & ")}
        </h1>
        <div className="flex items-center gap-0.5">
          {pendingCount > 0 && (
            <span className="text-[10px] font-semibold text-green-600 bg-green-100 border border-green-300 px-1.5 py-0.5 rounded-full mr-1">
              {pendingCount}
            </span>
          )}
          <Link href="/trends"><Button variant="ghost" size="icon" className="h-9 w-9"><TrendingUp className="w-5 h-5" /></Button></Link>
          <Link href="/family"><Button variant="ghost" size="icon" className="h-9 w-9"><GroupIcon className="w-5 h-5" /></Button></Link>
          <Link href="/notifications" onClick={() => setUnreadCount(0)} className="relative">
            <Button variant="ghost" size="icon" className="h-9 w-9"><Bell className="w-5 h-5" /></Button>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <Link href="/settings"><Button variant="ghost" size="icon" className="h-9 w-9"><Settings className="w-5 h-5" /></Button></Link>
        </div>
      </header>

      {/* Today stats — below header */}
      {babies.length > 0 && (() => {
        const displaySummaries = summaries.length > 0
          ? summaries
          : babies.map(b => ({ babyId: b.id, feedings: 0, sleepMinutes: 0, diapers: 0 }))
        return (
          <div className="shrink-0 border-b bg-background w-full">
            {displaySummaries.map(s => {
              const sleepH = Math.floor(s.sleepMinutes / 60)
              const sleepM = s.sleepMinutes % 60
              const sleepStr = s.sleepMinutes === 0 ? "—" : sleepH > 0 ? `${sleepH}h ${sleepM}m` : `${sleepM}m`
              return (
                <div key={s.babyId} className="px-5 py-2 max-w-lg mx-auto w-full">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setSheet({ type: "feeding", babyId: s.babyId })}
                      className="flex items-center justify-center gap-2 py-2 rounded-xl active:opacity-60 transition-opacity bg-teal-400/15 border border-teal-400/30">
                      <span className="text-lg">🍼</span>
                      <span className="text-base font-bold text-teal-900 dark:text-teal-100">{s.feedings}</span>
                    </button>
                    <button onClick={() => setSheet({ type: "sleep", babyId: s.babyId })}
                      className="flex items-center justify-center gap-2 py-2 rounded-xl active:opacity-60 transition-opacity bg-violet-400/15 border border-violet-400/30">
                      <span className="text-lg">😴</span>
                      <span className="text-base font-bold text-violet-900 dark:text-violet-100">{sleepStr}</span>
                    </button>
                    <button onClick={() => setSheet({ type: "diaper", babyId: s.babyId })}
                      className="flex items-center justify-center gap-2 py-2 rounded-xl active:opacity-60 transition-opacity bg-rose-400/15 border border-rose-400/30">
                      <span className="text-lg">🧷</span>
                      <span className="text-base font-bold text-rose-900 dark:text-rose-100">{s.diapers}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Scrollable activity */}
      <main className="flex-1 overflow-y-auto px-5 pt-4 pb-[220px] max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Recent activity</p>
          <Link href="/history" className="text-xs text-primary font-medium">See all</Link>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No activity logged yet. Tap a button above to get started.</p>
        ) : (
          <div>
            {activity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${dotColors[item.type]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  {multipleBabies && babyMap[item.babyId] && (
                    <p className="text-xs text-muted-foreground">{babyMap[item.babyId]}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Log buttons — circular, fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="px-4 pt-3 pb-3 max-w-lg mx-auto w-full">
        <div className="flex justify-evenly items-start">

          {/* Feeding */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => handleTap("feeding")}
              disabled={logging === "feeding"}
              className={`w-[28vw] h-[28vw] rounded-full border-2 flex items-center justify-center active:scale-95 transition-all duration-150 ${flashSuccess === "feeding" ? "bg-teal-400/40 border-teal-400/80" : "bg-teal-400/20 border-teal-400/40"}`}>
              <span className="text-6xl">{flashSuccess === "feeding" ? "✅" : "🍼"}</span>
            </button>
            <p className="text-sm font-bold text-teal-900 dark:text-teal-100">Eat</p>
          </div>

          {/* Sleep */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => handleTap("sleep")}
              disabled={logging === "sleep"}
              className={`w-[28vw] h-[28vw] rounded-full border-2 flex items-center justify-center active:scale-95 transition-all duration-150 ${flashSuccess === "sleep" ? "bg-violet-400/40 border-violet-400/80" : activeSleep ? "bg-violet-400/30 border-violet-400/70" : "bg-violet-400/20 border-violet-400/40"}`}>
              <span className="text-6xl">{flashSuccess === "sleep" ? "✅" : "😴"}</span>
            </button>
            <p className="text-sm font-bold text-violet-900 dark:text-violet-100">
              {activeSleep ? sleepElapsed : "Sleep"}
            </p>
          </div>

          {/* Diaper */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => handleTap("diaper")}
              disabled={logging === "diaper"}
              className={`w-[28vw] h-[28vw] rounded-full border-2 flex items-center justify-center active:scale-95 transition-all duration-150 ${flashSuccess === "diaper" ? "bg-rose-400/40 border-rose-400/80" : "bg-rose-400/20 border-rose-400/40"}`}>
              {flashSuccess === "diaper" ? <span className="text-6xl">✅</span> : <img src="/diaper.webp" alt="diaper" className="w-12 h-12 object-contain" />}
            </button>
            <p className="text-sm font-bold text-rose-900 dark:text-rose-100">Change</p>
          </div>
        </div>

        {/* Detail links row */}
        <div className="flex justify-evenly mt-1">
          <Link href="/log/feeding" className="w-[28vw] flex justify-center text-[11px] text-muted-foreground">✏️</Link>
          <Link href="/log/sleep" className="w-[28vw] flex justify-center text-[11px] text-muted-foreground">✏️</Link>
          <Link href="/log/diaper" className="w-[28vw] flex justify-center text-[11px] text-muted-foreground">✏️</Link>
        </div>

        {/* Baby picker */}
        {picking && (
          <div className="mt-3 flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-muted-foreground w-full text-center font-medium">Which baby?</p>
            {babies.map(b => (
              <button key={b.id} onClick={() => { setPicking(null); doLog(picking, b.id) }}
                className="px-4 py-1.5 rounded-full bg-muted text-sm font-medium border">
                {b.name}
              </button>
            ))}
            <button onClick={() => setPicking(null)} className="px-4 py-1.5 rounded-full bg-muted border text-sm text-muted-foreground">Cancel</button>
          </div>
        )}
      </div>
      </div>

      {/* Daily detail sheet */}
      {sheet && (() => {
        const typeLabel = sheet.type === "feeding" ? "Feedings" : sheet.type === "sleep" ? "Sleep" : "Diapers"
        const babyName = multipleBabies ? babyMap[sheet.babyId] : null

        const rows = sheet.type === "feeding"
          ? todayLogs.feedings.filter(r => r.baby_id === sheet.babyId)
          : sheet.type === "sleep"
          ? todayLogs.sleeps.filter(r => r.baby_id === sheet.babyId)
          : todayLogs.diapers.filter(r => r.baby_id === sheet.babyId)

        function rowLabel(r: Record<string, string>): string {
          if (sheet.type === "feeding") return feedingLabel(r)
          if (sheet.type === "diaper") return diaperLabel(r)
          if (r.ended_at) {
            const mins = Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000)
            const h = Math.floor(mins / 60), m = mins % 60
            return h > 0 ? `Slept · ${h}h ${m}m` : `Slept · ${m} min`
          }
          return "Sleep in progress"
        }

        function rowTime(r: Record<string, string>): string {
          const ts = sheet.type === "diaper" ? r.logged_at : r.started_at
          return format(new Date(ts), "h:mm a")
        }

        function rowDetail(r: Record<string, string>): string | null {
          if (sheet.type === "sleep" && r.ended_at) {
            return `${format(new Date(r.started_at), "h:mm a")} – ${format(new Date(r.ended_at), "h:mm a")}`
          }
          if (sheet.type === "sleep" && !r.ended_at) return "Still sleeping"
          if (sheet.type === "feeding" && r.type === "breast" && r.duration_seconds) {
            return `${Math.round(Number(r.duration_seconds) / 60)} min`
          }
          if (sheet.type === "feeding" && r.notes) return r.notes
          return null
        }

        // Compute totals
        let totalLine = ""
        if (sheet.type === "sleep") {
          const totalMins = rows.reduce((acc: number, r: Record<string, string>) => {
            const start = new Date(r.started_at)
            const end = r.ended_at ? new Date(r.ended_at) : new Date()
            return acc + Math.round((end.getTime() - start.getTime()) / 60000)
          }, 0)
          const h = Math.floor(totalMins / 60), m = totalMins % 60
          totalLine = h > 0 ? `${h}h ${m}m total sleep` : `${m}m total sleep`
        } else if (sheet.type === "diaper") {
          totalLine = `${rows.length} change${rows.length !== 1 ? "s" : ""} today`
        } else if (sheet.type === "feeding") {
          const totalMl = rows.reduce((acc: number, r: Record<string, string>) => acc + (r.amount_ml ? Number(r.amount_ml) : 0), 0)
          const totalBreastMins = rows.reduce((acc: number, r: Record<string, string>) => acc + (r.type === "breast" && r.duration_seconds ? Math.round(Number(r.duration_seconds) / 60) : 0), 0)
          const parts = [`${rows.length} feeding${rows.length !== 1 ? "s" : ""}`]
          if (totalMl > 0) parts.push(`${totalMl}ml total`)
          if (totalBreastMins > 0) {
            const h = Math.floor(totalBreastMins / 60), m = totalBreastMins % 60
            parts.push(`${h > 0 ? `${h}h ${m}m` : `${m}m`} nursing`)
          }
          totalLine = parts.join(" · ")
        }

        return (
          <>
            <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setSheet(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pointer-events-none">
              <div className="bg-background rounded-2xl shadow-2xl w-full max-w-sm max-h-[60vh] flex flex-col pointer-events-auto">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
                  <h2 className="font-semibold">
                    Today&apos;s {typeLabel}{babyName ? ` · ${babyName}` : ""}
                  </h2>
                  <button onClick={() => setSheet(null)} className="text-muted-foreground text-sm px-2 py-1">Done</button>
                </div>
                {totalLine && (
                  <div className="px-4 py-3 border-b bg-muted/40">
                    <p className="text-sm font-semibold text-center">{totalLine}</p>
                  </div>
                )}
                <div className="overflow-y-auto flex-1 px-4 py-2">
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Nothing logged today.</p>
                  ) : (
                    <div className="divide-y">
                      {rows.map((r: Record<string, string>) => (
                        <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{rowLabel(r)}</p>
                            {rowDetail(r) && <p className="text-xs text-muted-foreground">{rowDetail(r)}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{rowTime(r)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
