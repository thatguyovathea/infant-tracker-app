"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { formatDistanceToNow, differenceInMinutes, format } from "date-fns"
import { Settings, Bell, ScanBarcode, FilePen } from "lucide-react"
import { useDashboardBg } from "@/lib/dashboard-bg"
import { BarcodeScannerModal } from "@/components/barcode-scanner-modal"
import { canScan } from "@/lib/barcode-scanner"
import { lookupFood, lookupGeneral } from "@/lib/product-lookup"
import { BarChart, Bar, XAxis, Cell, ResponsiveContainer } from "recharts"
import { registerPushNotifications } from "@/lib/push-notifications"
import { enqueue, readQueue, removeFromQueue, bumpRetry } from "@/lib/offline-queue"
import { Walkthrough } from "@/components/walkthrough"

function GroupIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="4.5" cy="9" r="2" />
      <path d="M1 21v-1a4 4 0 0 1 4-4h.5" />
      <circle cx="19.5" cy="9" r="2" />
      <path d="M23 21v-1a4 4 0 0 0-4-4h-.5" />
      <circle cx="12" cy="7" r="3" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  )
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadRemotePrefs(client: any, userId: string): Promise<QuickPrefs | null> {
  const { data } = await client.from("user_preferences").select("quick_prefs").eq("user_id", userId).maybeSingle()
  if (!data?.quick_prefs) return null
  return { ...DEFAULT_PREFS, ...data.quick_prefs }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveRemotePrefs(client: any, userId: string, prefs: QuickPrefs) {
  await client.from("user_preferences").upsert({ user_id: userId, quick_prefs: prefs, updated_at: new Date().toISOString() })
}

type Baby = { id: string; name: string }
type ActivityItem = { id: string; type: "feeding" | "sleep" | "diaper"; label: string; timestamp: string; babyId: string }
type ActiveSleep = { id: string; babyId: string; startedAt: string }
type DailySummary = { babyId: string; feedings: number; sleepMinutes: number; diapers: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TodayLogs = { feedings: any[]; sleeps: any[]; diapers: any[] }
type WeekDay = { day: string; value: number }

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

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]

// ---------- dashboard cache (stale-while-revalidate) ----------
const DASH_CACHE_KEY = "dash-cache-v3"
type DashCache = {
  userId: string
  familyId: string
  displayName: string
  babies: Baby[]
  activity: ActivityItem[]
  summaries: DailySummary[]
  todayLogs: TodayLogs
  weekFeedings: WeekDay[]
  weekSleep: WeekDay[]
  unreadCount: number
  prefs: QuickPrefs
}
function readDashCache(): DashCache | null {
  try {
    const raw = localStorage.getItem(DASH_CACHE_KEY)
    return raw ? (JSON.parse(raw) as DashCache) : null
  } catch { return null }
}
function saveDashCache(d: DashCache) {
  try { localStorage.setItem(DASH_CACHE_KEY, JSON.stringify(d)) } catch { /* storage full */ }
}
// --------------------------------------------------------------

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
  const [picking, setPicking] = useState<"feeding" | "sleep" | "diaper" | null>(null)
  const [logging, setLogging] = useState<"feeding" | "sleep" | "diaper" | null>(null)
  const [flashSuccess, setFlashSuccess] = useState<"feeding" | "sleep" | "diaper" | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [displayName, setDisplayName] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const didDrag = useRef(false)
  const drawerHandleRef = useRef<HTMLDivElement>(null)
  const drawerOuterRef = useRef<HTMLDivElement>(null)
  const drawerContentRef = useRef<HTMLDivElement>(null)
  const startDrawerHeight = useRef<number>(0)
  const [weekFeedings, setWeekFeedings] = useState<WeekDay[]>([])
  const [weekSleep, setWeekSleep] = useState<WeekDay[]>([])
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)
  const eventCirclesRef = useRef<HTMLDivElement>(null)
  const chartsRef = useRef<HTMLDivElement>(null)
  const familyIconRef = useRef<HTMLButtonElement>(null)
  const activityIconRef = useRef<HTMLButtonElement>(null)
  const scanIconRef = useRef<HTMLButtonElement>(null)
  const notificationsIconRef = useRef<HTMLButtonElement>(null)
  const settingsIconRef = useRef<HTMLButtonElement>(null)
  const { bg } = useDashboardBg()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }

      // Restore from cache immediately — eliminates loading screen on repeat opens
      const cache = readDashCache()
      if (cache && cache.userId === session.user.id) {
        setBabies(cache.babies)
        setActivity(cache.activity)
        setSummaries(cache.summaries)
        setTodayLogs(cache.todayLogs)
        setWeekFeedings(cache.weekFeedings)
        setWeekSleep(cache.weekSleep)
        setUnreadCount(cache.unreadCount)
        setPrefs(cache.prefs)
        setFamilyId(cache.familyId)
        setUserId(cache.userId)
        setDisplayName(cache.displayName)
        setLoading(false)
      }

      const client = await getAuthedClient()
      if (!client) { if (!cache) router.replace("/login"); return }

      const { data: membership } = await client
        .from("family_members").select("family_id")
        .eq("user_id", session.user.id).limit(1).maybeSingle()
      if (!membership) { router.replace("/onboarding"); return }

      const fid = membership.family_id
      setFamilyId(fid)
      setUserId(session.user.id)

      const { data: profile } = await client.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle()
      setDisplayName(profile?.display_name ?? "Someone")

      const { data: notifs } = await client.from("notifications").select("id, read_by").eq("family_id", fid)
      const unread = (notifs ?? []).filter(n => !(n.read_by ?? []).includes(session.user.id))
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

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
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
        const end = s.ended_at ? new Date(s.ended_at) : new Date()
        summaryMap[s.baby_id].sleepMinutes += Math.round((end.getTime() - new Date(s.started_at).getTime()) / 60000)
      })
      setSummaries(Object.values(summaryMap))

      if (openSleep && openSleep.length > 0) {
        setActiveSleep({ id: openSleep[0].id, babyId: openSleep[0].baby_id, startedAt: openSleep[0].started_at })
      }

      const authedClient = await getAuthedClient()
      const remote = authedClient ? await loadRemotePrefs(authedClient, session.user.id) : null
      const stored = remote ?? loadLocalPrefs()
      if (feedings && feedings.length > 0) {
        const last = feedings[0]
        stored.feeding = {
          type: last.type ?? stored.feeding.type,
          side: last.side ?? stored.feeding.side,
          amount_ml: last.amount_ml ? String(last.amount_ml) : stored.feeding.amount_ml,
          food_name: last.food_name ?? stored.feeding.food_name,
        }
      }
      if (diapers && diapers.length > 0) stored.diaper.type = diapers[0].type ?? stored.diaper.type
      setPrefs(stored)
      saveLocalPrefs(stored)
      if (authedClient) saveRemotePrefs(authedClient, session.user.id, stored).catch(err => console.error("[prefs]", err))

      const items: ActivityItem[] = [
        ...(feedings ?? []).map(r => ({ id: r.id, type: "feeding" as const, label: feedingLabel(r), timestamp: r.started_at, babyId: r.baby_id })),
        ...(sleeps ?? []).map(r => ({ id: r.id, type: "sleep" as const, label: sleepLabel(r), timestamp: r.started_at, babyId: r.baby_id })),
        ...(diapers ?? []).map(r => ({ id: r.id, type: "diaper" as const, label: diaperLabel(r), timestamp: r.logged_at, babyId: r.baby_id })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15)
      setActivity(items)

      // 7-day sparkline data
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); sevenDaysAgo.setHours(0, 0, 0, 0)
      const [{ data: wf }, { data: ws }] = await Promise.all([
        client.from("feeding_logs").select("started_at").eq("family_id", fid).gte("started_at", sevenDaysAgo.toISOString()),
        client.from("sleep_logs").select("started_at, ended_at").eq("family_id", fid).gte("started_at", sevenDaysAgo.toISOString()).not("ended_at", "is", null),
      ])
      setWeekFeedings(Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sevenDaysAgo); d.setDate(d.getDate() + i)
        const prefix = d.toISOString().slice(0, 10)
        return { day: DAY_LABELS[d.getDay()], value: (wf ?? []).filter(f => f.started_at.startsWith(prefix)).length }
      }))
      setWeekSleep(Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sevenDaysAgo); d.setDate(d.getDate() + i)
        const prefix = d.toISOString().slice(0, 10)
        const mins = (ws ?? []).filter(s => s.started_at.startsWith(prefix))
          .reduce((acc, s) => acc + differenceInMinutes(new Date(s.ended_at), new Date(s.started_at)), 0)
        return { day: DAY_LABELS[d.getDay()], value: Math.round(mins / 6) / 10 }
      }))

      // Save fresh data to cache for next open
      saveDashCache({
        userId: session.user.id,
        familyId: fid,
        displayName: profile?.display_name ?? "Someone",
        babies: babiesData ?? [],
        activity: items,
        summaries: Object.values(summaryMap),
        todayLogs: { feedings: todayFeedings ?? [], sleeps: todaySleeps ?? [], diapers: todayDiapers ?? [] },
        weekFeedings: Array.from({ length: 7 }, (_, i) => {
          const d = new Date(sevenDaysAgo); d.setDate(d.getDate() + i)
          const prefix = d.toISOString().slice(0, 10)
          return { day: DAY_LABELS[d.getDay()], value: (wf ?? []).filter(f => f.started_at.startsWith(prefix)).length }
        }),
        weekSleep: Array.from({ length: 7 }, (_, i) => {
          const d = new Date(sevenDaysAgo); d.setDate(d.getDate() + i)
          const prefix = d.toISOString().slice(0, 10)
          const mins = (ws ?? []).filter(s => s.started_at.startsWith(prefix))
            .reduce((acc, s) => acc + differenceInMinutes(new Date(s.ended_at), new Date(s.started_at)), 0)
          return { day: DAY_LABELS[d.getDay()], value: Math.round(mins / 6) / 10 }
        }),
        unreadCount: (notifs ?? []).filter(n => !(n.read_by ?? []).includes(session.user.id)).length,
        prefs: stored,
      })

      setLoading(false)
      setPendingCount(readQueue().length)
      registerPushNotifications()

      // Set up realtime subscription with family_id filter
      const rtSupa = createClient()
      const ch = rtSupa.channel("notifications")
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "notifications",
          filter: `family_id=eq.${fid}`,
        }, (payload: { new?: { actor_id?: string } }) => {
          // Don't increment for self-authored notifications
          if (payload.new?.actor_id === session.user.id) return
          setUnreadCount(prev => prev + 1)
        })
        .subscribe()
      channelRef.current = ch
    }
    load().catch(() => setLoading(false))

    let syncing = false
    async function syncQueue() {
      if (syncing) return
      syncing = true
      const queue = readQueue()
      if (!queue.length) { syncing = false; return }
      const client = await getAuthedClient()
      if (!client) { syncing = false; return }
      let dropped = 0
      for (const item of queue) {
        try {
          let ok = true
          if (item.operation === "insert") {
            const { error } = await client.from(item.table).insert(item.data)
            if (error) ok = false
          } else if (item.operation === "update") {
            const { error } = await client.from(item.table).update(item.data).eq("id", item.rowId)
            if (error) ok = false
          }
          if (ok) {
            if (item.notification) try { await client.from("notifications").insert(item.notification) } catch { /* best-effort */ }
            removeFromQueue(item.id)
          } else if (!bumpRetry(item.id)) {
            dropped++
          }
        } catch {
          if (!bumpRetry(item.id)) dropped++
        }
      }
      const remaining = readQueue().length
      setPendingCount(remaining)
      if (dropped > 0) {
        console.warn(`[offline-queue] ${dropped} item(s) dropped after max retries`)
      }
      syncing = false
    }
    window.addEventListener("online", syncQueue)
    // Sync any queued items immediately if already online
    if (navigator.onLine) syncQueue()

    // Sync unread count from cache when user returns from notifications page
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        try {
          const raw = localStorage.getItem("dash-cache-v3")
          if (raw) {
            const cache = JSON.parse(raw)
            if (typeof cache.unreadCount === "number") setUnreadCount(cache.unreadCount)
          }
        } catch { /* ignore */ }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      if (channelRef.current) createClient().removeChannel(channelRef.current)
      window.removeEventListener("online", syncQueue)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [router])

  useEffect(() => {
    if (!activeSleep) return
    function tick() {
      const mins = differenceInMinutes(new Date(), new Date(activeSleep!.startedAt))
      const h = Math.floor(mins / 60), m = mins % 60
      setSleepElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [activeSleep])

  const babyMap = useMemo(() => Object.fromEntries(babies.map(b => [b.id, b.name])), [babies])

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
        type: p.type, side: p.type === "breast" ? p.side : null,
        amount_ml: p.type === "bottle" && p.amount_ml ? parseFloat(p.amount_ml) : null,
        food_name: p.type === "solid" && p.food_name ? p.food_name : null,
        started_at: new Date().toISOString(),
      }
      const notifData = { family_id: familyId, actor_id: logUserId ?? undefined, type: "feeding", title: `${actor} logged a feeding`, body: `${feedingPresetLabel(p)} for ${babyName}` }
      const newItem: ActivityItem = { id: crypto.randomUUID(), type: "feeding", label: feedingPresetLabel(p), timestamp: feedData.started_at, babyId }
      setActivity(prev => [newItem, ...prev].slice(0, 15))
      setSummaries(prev => prev.map(s => s.babyId === babyId ? { ...s, feedings: s.feedings + 1 } : s))
      setWeekFeedings(prev => prev.map((d, i) => i === 6 ? { ...d, value: d.value + 1 } : d))
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
      const diaperData = { baby_id: babyId, family_id: familyId, logged_by: logUserId, type: p.type, logged_at: new Date().toISOString() }
      const notifData = { family_id: familyId, actor_id: logUserId ?? undefined, type: "diaper", title: `${actor} logged a diaper change`, body: `${labelMap[p.type]} for ${babyName}` }
      const newItem: ActivityItem = { id: crypto.randomUUID(), type: "diaper", label: labelMap[p.type], timestamp: diaperData.logged_at, babyId }
      setActivity(prev => [newItem, ...prev].slice(0, 15))
      setSummaries(prev => prev.map(s => s.babyId === babyId ? { ...s, diapers: s.diapers + 1 } : s))
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
        const notifData = { family_id: familyId, actor_id: logUserId ?? undefined, type: "sleep", title: `${actor} ended sleep`, body: `${babyName} slept for ${durationStr}` }
        const newItem: ActivityItem = { id: activeSleep.id, type: "sleep", label: `Slept · ${durationStr}`, timestamp: activeSleep.startedAt, babyId }
        setActivity(prev => [newItem, ...prev.filter(i => i.id !== activeSleep.id)].slice(0, 15))
        setSummaries(prev => prev.map(s => s.babyId === babyId ? { ...s, sleepMinutes: s.sleepMinutes + mins } : s))
        setWeekSleep(prev => prev.map((d, i) => i === 6 ? { ...d, value: Math.round((d.value * 60 + mins) / 6) / 10 } : d))
        setActiveSleep(null); setSleepElapsed("")
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
        const sleepData = { baby_id: babyId, family_id: familyId, logged_by: logUserId, started_at: startedAt }
        const notifData = { family_id: familyId, actor_id: logUserId ?? undefined, type: "sleep", title: `${actor} started sleep`, body: `${babyName} is now sleeping` }
        if (offline) {
          const localId = crypto.randomUUID()
          setActiveSleep({ id: localId, babyId, startedAt })
          setActivity(prev => [{ id: localId, type: "sleep" as const, label: "Sleep started", timestamp: startedAt, babyId }, ...prev].slice(0, 15))
          enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "insert", table: "sleep_logs", data: sleepData, notification: notifData })
          setPendingCount(c => c + 1)
        } else {
          try {
            const { data } = await client.from("sleep_logs").insert(sleepData).select().single()
            if (data) {
              setActiveSleep({ id: data.id, babyId, startedAt: data.started_at })
              setActivity(prev => [{ id: data.id, type: "sleep" as const, label: "Sleep started", timestamp: data.started_at, babyId }, ...prev].slice(0, 15))
              await client.from("notifications").insert({ ...notifData, reference_id: data.id })
            }
          } catch {
            const localId = crypto.randomUUID()
            setActiveSleep({ id: localId, babyId, startedAt })
            setActivity(prev => [{ id: localId, type: "sleep" as const, label: "Sleep started", timestamp: startedAt, babyId }, ...prev].slice(0, 15))
            enqueue({ id: crypto.randomUUID(), queuedAt: new Date().toISOString(), operation: "insert", table: "sleep_logs", data: sleepData, notification: notifData })
            setPendingCount(c => c + 1)
          }
        }
      }
    }

    const { data: { session: s } } = await createClient().auth.getSession()
    if (s) { saveLocalPrefs(prefs); saveRemotePrefs(client, s.user.id, prefs).catch(err => console.error("[prefs]", err)) }
    setLogging(null)
    setFlashSuccess(type)
    setTimeout(() => setFlashSuccess(null), 1500)
  }, [familyId, prefs, activeSleep, router, displayName, babyMap, userId])

  async function handleScanResult(barcode: string) {
    setScanning(false)
    const food = await lookupFood(barcode)
    if (food) {
      const params = new URLSearchParams({ type: "solid", food_name: food.name })
      if (food.allergens.length) params.set("allergens", food.allergens.join(","))
      router.push(`/log/feeding?${params.toString()}`)
      return
    }
    const general = await lookupGeneral(barcode)
    router.push(general ? `/log/diaper?product=${encodeURIComponent(general.name)}` : "/log/diaper")
  }

  function handleTap(type: "feeding" | "sleep" | "diaper") {
    if (babies.length === 0) return
    if (babies.length === 1) doLog(type, babies[0].id)
    else setPicking(type)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  )

  const multipleBabies = babies.length > 1
  const dotColors: Record<string, string> = { feeding: "bg-sky-400", sleep: "bg-violet-400", diaper: "bg-emerald-400" }

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {scanning && <BarcodeScannerModal onResult={handleScanResult} onClose={() => setScanning(false)} />}

      {bg.image && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={bg.image} alt="" className="w-full h-full object-cover"
            style={{ opacity: bg.opacity, filter: `blur(${bg.blur}px)`, transform: "scale(1.05)" }} />
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 px-5 pt-5 pb-2 flex items-center justify-between max-w-lg mx-auto w-full">
        <h1 className="text-3xl font-bold leading-tight">
          {babies.length === 0 ? "Add a baby" : babies.map(b => b.name).join(" & ")}
        </h1>
        <div className="flex items-center gap-0.5">
          {pendingCount > 0 && (
            <span className="text-[10px] font-semibold text-green-600 bg-green-100 border border-green-300 px-1.5 py-0.5 rounded-full mr-1">
              {pendingCount}
            </span>
          )}
          <button ref={settingsIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted" onClick={() => router.push("/settings")}>
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Today stats */}
      {babies.length > 0 && (() => {
        const displaySummaries = summaries.length > 0
          ? summaries
          : babies.map(b => ({ babyId: b.id, feedings: 0, sleepMinutes: 0, diapers: 0 }))
        return (
          <div className="relative z-10 shrink-0 border-b bg-background/80 backdrop-blur-sm w-full">
            {displaySummaries.map(s => {
              const sleepH = Math.round(s.sleepMinutes / 60)
              const sleepStr = s.sleepMinutes === 0 ? "—" : s.sleepMinutes < 30 ? "<1h" : `${sleepH}h`
              return (
                <div key={s.babyId} className="px-5 py-2 max-w-lg mx-auto w-full">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setSheet({ type: "feeding", babyId: s.babyId })}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl active:opacity-60 transition-opacity bg-sky-400/25">
                      <span className="text-2xl">🍼</span>
                      <span className="text-xl font-bold text-sky-200">{s.feedings}</span>
                    </button>
                    <button onClick={() => setSheet({ type: "sleep", babyId: s.babyId })}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl active:opacity-60 transition-opacity bg-violet-400/25">
                      <span className="text-2xl">😴</span>
                      <span className="text-xl font-bold text-violet-200">{sleepStr}</span>
                    </button>
                    <button onClick={() => setSheet({ type: "diaper", babyId: s.babyId })}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl active:opacity-60 transition-opacity bg-emerald-400/25">
                      <span className="text-2xl">🧷</span>
                      <span className="text-xl font-bold text-emerald-200">{s.diapers}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Middle: charts (collapsed) or activity (open) */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden w-full">
        <div className="flex-1 flex flex-col overflow-hidden max-w-lg mx-auto w-full">

          {/* Charts section — visible when drawer is closed */}
          <div ref={chartsRef} className={`flex flex-col overflow-hidden transition-all duration-300 ${drawerOpen ? "max-h-0 opacity-0" : "flex-1 min-h-0 opacity-100"}`}>
            <div className="flex-1 flex flex-col min-h-0 px-4 pt-3 pb-2 gap-3">
              <button onClick={() => router.push("/trends")} className="flex-1 min-h-0 rounded-xl border bg-card p-3 flex flex-col text-left active:opacity-70 transition-opacity">
                <p className="text-xs font-semibold text-muted-foreground mb-1 shrink-0">Feedings · 7 days</p>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekFeedings} barCategoryGap="15%">
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {weekFeedings.map((d, i) => (
                          <Cell key={d.day + i} fill={i === 6 ? "rgb(56 189 248)" : "rgb(56 189 248 / 0.4)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </button>
              <button onClick={() => router.push("/trends")} className="flex-1 min-h-0 rounded-xl border bg-card p-3 flex flex-col text-left active:opacity-70 transition-opacity">
                <p className="text-xs font-semibold text-muted-foreground mb-1 shrink-0">Sleep · 7 days</p>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekSleep} barCategoryGap="15%">
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {weekSleep.map((d, i) => (
                          <Cell key={d.day + i} fill={i === 6 ? "rgb(139 92 246)" : "rgb(139 92 246 / 0.4)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </button>
            </div>
          </div>

          {/* Drag handle + activity header — merged so pill and text share symmetric padding */}
          {/* Activity section — header always visible, list expands when open */}
          <div ref={drawerOuterRef} className="flex flex-col shrink-0">
            <div
              ref={drawerHandleRef}
              className="shrink-0 flex flex-col items-center border-t bg-background/80 touch-none py-2 gap-1.5"
              onClick={() => {
                if (didDrag.current) { didDrag.current = false; return }
                // Clear any leftover inline style from a previous drag-close before opening
                if (!drawerOpen && drawerContentRef.current) {
                  drawerContentRef.current.style.maxHeight = ''
                  drawerContentRef.current.style.transition = ''
                }
                setDrawerOpen(p => !p)
              }}
              onTouchStart={e => {
                dragStartY.current = e.touches[0].clientY
                didDrag.current = false
                startDrawerHeight.current = drawerContentRef.current?.getBoundingClientRect().height ?? 0
              }}
              onTouchMove={e => {
                if (dragStartY.current === null) return
                const delta = dragStartY.current - e.touches[0].clientY
                if (Math.abs(delta) > 5) didDrag.current = true
                const contentEl = drawerContentRef.current
                const outerEl = drawerOuterRef.current
                const maxH = window.innerHeight * 0.7
                // maxHeight grows when dragging up, shrinks when dragging down
                const newH = Math.max(0, Math.min(startDrawerHeight.current + delta, maxH))
                if (contentEl) { contentEl.style.transition = 'none'; contentEl.style.maxHeight = `${newH}px` }
                // translateY moves the whole drawer down when closing (finger follows handle)
                const ty = Math.max(0, -delta)
                if (outerEl) { outerEl.style.transition = 'none'; outerEl.style.transform = ty > 0 ? `translateY(${ty}px)` : '' }
              }}
              onTouchEnd={() => {
                dragStartY.current = null
                if (!didDrag.current) return
                const contentEl = drawerContentRef.current
                const outerEl = drawerOuterRef.current
                const currentH = contentEl ? parseFloat(contentEl.style.maxHeight) || 0 : 0
                const draggedDown = startDrawerHeight.current - currentH
                const shouldOpen = draggedDown < 100
                if (outerEl) { outerEl.style.transition = 'transform 300ms ease-out'; outerEl.style.transform = 'translateY(0)' }
                if (contentEl) { contentEl.style.transition = 'max-height 300ms ease-out'; contentEl.style.maxHeight = shouldOpen ? `${window.innerHeight * 0.7}px` : '0px' }
                setTimeout(() => {
                  if (outerEl) { outerEl.style.transform = ''; outerEl.style.transition = '' }
                  if (shouldOpen) {
                    // Opening: clear inline style and hand control back to Tailwind class
                    setDrawerOpen(true)
                    if (contentEl) { contentEl.style.maxHeight = ''; contentEl.style.transition = '' }
                  } else {
                    // Closing: update state but keep inline maxHeight=0 to prevent flash
                    // Tailwind class will be max-h-0 anyway; inline style cleared on next open
                    setDrawerOpen(false)
                    if (contentEl) { contentEl.style.transition = '' }
                  }
                }, 320)
              }}
              onMouseDown={e => {
                dragStartY.current = e.clientY
                didDrag.current = false
                startDrawerHeight.current = drawerContentRef.current?.getBoundingClientRect().height ?? 0
              }}
              onMouseMove={e => {
                if (dragStartY.current === null || e.buttons === 0) return
                const delta = dragStartY.current - e.clientY
                if (Math.abs(delta) > 5) didDrag.current = true
                const contentEl = drawerContentRef.current
                const outerEl = drawerOuterRef.current
                const maxH = window.innerHeight * 0.7
                const newH = Math.max(0, Math.min(startDrawerHeight.current + delta, maxH))
                if (contentEl) { contentEl.style.transition = 'none'; contentEl.style.maxHeight = `${newH}px` }
                const ty = Math.max(0, -delta)
                if (outerEl) { outerEl.style.transition = 'none'; outerEl.style.transform = ty > 0 ? `translateY(${ty}px)` : '' }
              }}
              onMouseUp={() => {
                dragStartY.current = null
                if (!didDrag.current) return
                const contentEl = drawerContentRef.current
                const outerEl = drawerOuterRef.current
                const currentH = contentEl ? parseFloat(contentEl.style.maxHeight) || 0 : 0
                const draggedDown = startDrawerHeight.current - currentH
                const shouldOpen = draggedDown < 100
                if (outerEl) { outerEl.style.transition = 'transform 300ms ease-out'; outerEl.style.transform = 'translateY(0)' }
                if (contentEl) { contentEl.style.transition = 'max-height 300ms ease-out'; contentEl.style.maxHeight = shouldOpen ? `${window.innerHeight * 0.7}px` : '0px' }
                setTimeout(() => {
                  if (outerEl) { outerEl.style.transform = ''; outerEl.style.transition = '' }
                  if (shouldOpen) {
                    setDrawerOpen(true)
                    if (contentEl) { contentEl.style.maxHeight = ''; contentEl.style.transition = '' }
                  } else {
                    setDrawerOpen(false)
                    if (contentEl) { contentEl.style.transition = '' }
                  }
                }, 320)
              }}
              onMouseLeave={() => { dragStartY.current = null }}
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              <div className="flex items-center justify-center w-full px-5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest leading-none m-0">Recent activity</p>
              </div>
            </div>
            <div ref={drawerContentRef} className={`overflow-y-auto overflow-hidden transition-[max-height] duration-300 ease-out ${drawerOpen ? "max-h-[70vh]" : "max-h-0"}`}>
              <div className="px-5 pb-2">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No activity yet.</p>
                ) : activity.map(item => (
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
            </div>
          </div>
        </div>
      </div>

      {/* Event circles */}
      <div className="relative z-10 shrink-0 border-t bg-background">
        <div className="px-4 pt-3 pb-3 max-w-lg mx-auto w-full">
          <div ref={eventCirclesRef} className="flex justify-evenly items-start">
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => handleTap("feeding")} disabled={logging === "feeding"}
                className={`w-[30vw] h-[30vw] rounded-full border-0 flex items-center justify-center active:scale-95 transition-all duration-150 ${flashSuccess === "feeding" ? "bg-sky-400/40" : "bg-sky-400/20"}`}>
                <span className="text-6xl">{flashSuccess === "feeding" ? "✅" : "🍼"}</span>
              </button>
              <p className="text-sm font-bold text-sky-900 dark:text-sky-100">Eat</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => handleTap("sleep")} disabled={logging === "sleep"}
                className={`w-[30vw] h-[30vw] rounded-full border-0 flex items-center justify-center active:scale-95 transition-all duration-150 ${flashSuccess === "sleep" ? "bg-violet-400/40" : activeSleep ? "bg-violet-400/30" : "bg-violet-400/20"}`}>
                <span className="text-6xl">{flashSuccess === "sleep" ? "✅" : "😴"}</span>
              </button>
              <p className="text-sm font-bold text-violet-900 dark:text-violet-100">
                {activeSleep ? sleepElapsed : "Sleep"}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => handleTap("diaper")} disabled={logging === "diaper"}
                className={`w-[30vw] h-[30vw] rounded-full border-0 flex items-center justify-center active:scale-95 transition-all duration-150 ${flashSuccess === "diaper" ? "bg-emerald-400/40" : "bg-emerald-400/20"}`}>
                {flashSuccess === "diaper" ? <span className="text-6xl">✅</span> : <img src="/diaper.webp" alt="diaper" className="w-12 h-12 object-contain" />}
              </button>
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Change</p>
            </div>
          </div>

          {picking && (
            <div className="mt-3 flex gap-2 flex-wrap justify-center">
              <p className="text-xs text-muted-foreground w-full text-center font-medium">Which baby?</p>
              {babies.map(b => (
                <button key={b.id} onClick={() => { setPicking(null); doLog(picking, b.id) }}
                  className="px-4 py-1.5 rounded-full bg-muted text-sm font-medium border">{b.name}</button>
              ))}
              <button onClick={() => setPicking(null)} className="px-4 py-1.5 rounded-full bg-muted border text-sm text-muted-foreground">Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom ribbon — family | activity | scan | bell */}
      <div className="relative z-10 shrink-0 border-t bg-background" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-evenly px-6 py-1 max-w-lg mx-auto w-full">
          <button ref={familyIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => router.push("/family")}>
            <GroupIcon className="w-5 h-5" />
          </button>
          <button ref={activityIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => router.push("/history")}>
            <FilePen className="w-5 h-5" />
          </button>
          {canScan() ? (
            <button ref={scanIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => setScanning(true)}>
              <ScanBarcode className="w-5 h-5" />
            </button>
          ) : <div className="h-9 w-9" />}
          <button ref={notificationsIconRef} className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => { setUnreadCount(0); router.push("/notifications") }}>
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <Walkthrough refs={{
        eventCircles: eventCirclesRef,
        drawerHandle: drawerHandleRef,
        charts: chartsRef,
        familyIcon: familyIconRef,
        activityIcon: activityIconRef,
        scanIcon: scanIconRef,
        notificationsIcon: notificationsIconRef,
        settingsIcon: settingsIconRef,
      }} />

      {/* Daily detail sheet */}
      {sheet && (() => {
        const s = sheet
        const typeLabel = s.type === "feeding" ? "Feedings" : s.type === "sleep" ? "Sleep" : "Diapers"
        const babyName = multipleBabies ? babyMap[s.babyId] : null
        const rows = s.type === "feeding" ? todayLogs.feedings.filter(r => r.baby_id === s.babyId)
          : s.type === "sleep" ? todayLogs.sleeps.filter(r => r.baby_id === s.babyId)
          : todayLogs.diapers.filter(r => r.baby_id === s.babyId)

        function rowLabel(r: Record<string, string>): string {
          if (s.type === "feeding") return feedingLabel(r)
          if (s.type === "diaper") return diaperLabel(r)
          if (r.ended_at) { const mins = Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000); const h = Math.floor(mins / 60), m = mins % 60; return h > 0 ? `Slept · ${h}h ${m}m` : `Slept · ${m} min` }
          return "Sleep in progress"
        }
        function rowTime(r: Record<string, string>): string { return format(new Date(s.type === "diaper" ? r.logged_at : r.started_at), "h:mm a") }
        function rowDetail(r: Record<string, string>): string | null {
          if (s.type === "sleep" && r.ended_at) return `${format(new Date(r.started_at), "h:mm a")} – ${format(new Date(r.ended_at), "h:mm a")}`
          if (s.type === "sleep" && !r.ended_at) return "Still sleeping"
          if (s.type === "feeding" && r.type === "breast" && r.duration_seconds) return `${Math.round(Number(r.duration_seconds) / 60)} min`
          if (s.type === "feeding" && r.notes) return r.notes
          return null
        }

        let totalLine = ""
        if (s.type === "sleep") {
          const totalMins = rows.reduce((acc: number, r: Record<string, string>) => acc + Math.round(((r.ended_at ? new Date(r.ended_at) : new Date()).getTime() - new Date(r.started_at).getTime()) / 60000), 0)
          const h = Math.floor(totalMins / 60), m = totalMins % 60
          totalLine = h > 0 ? `${h}h ${m}m total sleep` : `${m}m total sleep`
        } else if (s.type === "diaper") {
          totalLine = `${rows.length} change${rows.length !== 1 ? "s" : ""} today`
        } else {
          const totalMl = rows.reduce((acc: number, r: Record<string, string>) => acc + (r.amount_ml ? Number(r.amount_ml) : 0), 0)
          const totalBreastMins = rows.reduce((acc: number, r: Record<string, string>) => acc + (r.type === "breast" && r.duration_seconds ? Math.round(Number(r.duration_seconds) / 60) : 0), 0)
          const parts = [`${rows.length} feeding${rows.length !== 1 ? "s" : ""}`]
          if (totalMl > 0) parts.push(`${totalMl}ml total`)
          if (totalBreastMins > 0) { const h = Math.floor(totalBreastMins / 60), m = totalBreastMins % 60; parts.push(`${h > 0 ? `${h}h ${m}m` : `${m}m`} nursing`) }
          totalLine = parts.join(" · ")
        }

        return (
          <>
            <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setSheet(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pointer-events-none">
              <div className="bg-background rounded-2xl shadow-2xl w-full max-w-sm max-h-[60vh] flex flex-col pointer-events-auto">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
                  <h2 className="font-semibold">Today&apos;s {typeLabel}{babyName ? ` · ${babyName}` : ""}</h2>
                  <button onClick={() => setSheet(null)} className="text-muted-foreground text-sm px-2 py-1">Done</button>
                </div>
                {totalLine && <div className="px-4 py-3 border-b bg-muted/40"><p className="text-sm font-semibold text-center">{totalLine}</p></div>}
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
