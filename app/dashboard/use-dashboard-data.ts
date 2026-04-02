"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { differenceInMinutes } from "date-fns"
import { registerPushNotifications } from "@/lib/push-notifications"
import { enqueue, readQueue, removeFromQueue, bumpRetry } from "@/lib/offline-queue"
import { lookupFood, lookupGeneral } from "@/lib/product-lookup"
import {
  Baby, ActivityItem, ActiveSleep, DailySummary, TodayLogs, WeekDay, QuickPrefs,
  DEFAULT_PREFS, DAY_LABELS,
  readDashCache, saveDashCache,
  loadLocalPrefs, saveLocalPrefs, loadRemotePrefs, saveRemotePrefs,
  feedingLabel, sleepLabel, diaperLabel, feedingPresetLabel,
} from "./types"

export function useDashboardData() {
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
  const [weekFeedings, setWeekFeedings] = useState<WeekDay[]>([])
  const [weekSleep, setWeekSleep] = useState<WeekDay[]>([])

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)
  const rtClientRef = useRef<ReturnType<typeof createClient> | null>(null)

  // Refs for walkthrough + drag gesture
  const dragStartY = useRef<number | null>(null)
  const didDrag = useRef(false)
  const drawerHandleRef = useRef<HTMLDivElement>(null)
  const drawerOuterRef = useRef<HTMLDivElement>(null)
  const drawerContentRef = useRef<HTMLDivElement>(null)
  const startDrawerHeight = useRef<number>(0)
  const eventCirclesRef = useRef<HTMLDivElement>(null)
  const chartsRef = useRef<HTMLDivElement>(null)
  const familyIconRef = useRef<HTMLButtonElement>(null)
  const activityIconRef = useRef<HTMLButtonElement>(null)
  const scanIconRef = useRef<HTMLButtonElement>(null)
  const notificationsIconRef = useRef<HTMLButtonElement>(null)
  const settingsIconRef = useRef<HTMLButtonElement>(null)

  // Main data load effect
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }

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

      const { data: profile } = await client.from("profiles").select("display_name").eq("id", session.user.id).limit(1).maybeSingle()
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

      if (channelRef.current && rtClientRef.current) {
        rtClientRef.current.removeChannel(channelRef.current)
        channelRef.current = null
        rtClientRef.current = null
      }

      const rtSupa = createClient()
      const ch = rtSupa.channel("notifications")
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "notifications",
          filter: `family_id=eq.${fid}`,
        }, (payload: { new?: { actor_id?: string } }) => {
          if (payload.new?.actor_id === session.user.id) return
          setUnreadCount(prev => prev + 1)
        })
        .subscribe()
      channelRef.current = ch
      rtClientRef.current = rtSupa
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
    if (navigator.onLine) syncQueue()

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
      if (channelRef.current && rtClientRef.current) {
        rtClientRef.current.removeChannel(channelRef.current)
        channelRef.current = null
        rtClientRef.current = null
      }
      window.removeEventListener("online", syncQueue)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [router])

  // Sleep elapsed timer
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

  return {
    // State
    babies, familyId, activity, activeSleep, sleepElapsed, prefs,
    summaries, todayLogs, sheet, setSheet, loading, picking, setPicking,
    logging, flashSuccess, unreadCount, setUnreadCount, displayName, userId,
    pendingCount, scanning, setScanning, drawerOpen, setDrawerOpen,
    weekFeedings, weekSleep, babyMap,
    // Callbacks
    doLog, handleTap, handleScanResult,
    // Refs
    dragStartY, didDrag, drawerHandleRef, drawerOuterRef, drawerContentRef,
    startDrawerHeight, eventCirclesRef, chartsRef, familyIconRef,
    activityIconRef, scanIconRef, notificationsIconRef, settingsIconRef,
  }
}
