"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { format, isToday, isYesterday, differenceInMinutes } from "date-fns"

type Filter = "all" | "feeding" | "sleep" | "diaper" | "growth"
type Baby = { id: string; name: string }

type LogItem = {
  id: string
  type: "feeding" | "sleep" | "diaper" | "growth"
  label: string
  detail: string | null
  timestamp: string
  notes: string | null
}

const PAGE_SIZE = 30

const typeColors: Record<string, string> = {
  feeding: "bg-sky-500/20 border-sky-400/60 text-sky-300 backdrop-blur-sm",
  sleep:   "bg-violet-500/20 border-violet-400/60 text-violet-300 backdrop-blur-sm",
  diaper:  "bg-emerald-500/20 border-emerald-400/60 text-emerald-300 backdrop-blur-sm",
  growth:  "bg-amber-500/20 border-amber-400/60 text-amber-300 backdrop-blur-sm",
}

const typeEmoji: Record<string, string> = {
  feeding: "🍼",
  sleep: "😴",
  diaper: "💩",
  growth: "📏",
}

const tableFor: Record<string, string> = {
  feeding: "feeding_logs",
  sleep: "sleep_logs",
  diaper: "diaper_logs",
  growth: "growth_logs",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function feedingLabel(r: any): { label: string; detail: string | null } {
  if (r.type === "breast") {
    return { label: `Breastfed · ${r.side ?? ""} side`, detail: r.duration_seconds ? `${Math.round(r.duration_seconds / 60)} min` : null }
  }
  if (r.type === "bottle") {
    const detail = [r.amount_ml ? `${r.amount_ml}ml` : null, r.duration_seconds ? `${Math.round(r.duration_seconds / 60)} min` : null].filter(Boolean).join(" · ") || null
    return { label: "Bottle feeding", detail }
  }
  if (r.type === "solid") return { label: r.food_name ? `Solids · ${r.food_name}` : "Solids", detail: null }
  return { label: "Feeding", detail: null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sleepLabel(r: any): { label: string; detail: string | null } {
  if (r.ended_at) {
    const mins = differenceInMinutes(new Date(r.ended_at), new Date(r.started_at))
    const hours = Math.floor(mins / 60), rem = mins % 60
    const dur = hours > 0 ? `${hours}h ${rem}m` : `${rem} min`
    const qualityEmoji = r.quality === "good" ? "😊" : r.quality === "fair" ? "😐" : r.quality === "poor" ? "😟" : ""
    return { label: `Slept · ${dur}`, detail: qualityEmoji || null }
  }
  return { label: "Sleep started", detail: null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function diaperLabel(r: any): { label: string; detail: string | null } {
  const map: Record<string, string> = { wet: "Wet diaper", dirty: "Dirty diaper", both: "Wet & dirty diaper", dry: "Dry diaper" }
  return { label: map[r.type] ?? "Diaper change", detail: null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function growthLabel(r: any): { label: string; detail: string | null } {
  const parts: string[] = []
  if (r.weight_kg) parts.push(`${r.weight_kg} kg`)
  if (r.height_cm) parts.push(`${r.height_cm} cm`)
  if (r.head_cm) parts.push(`head ${r.head_cm} cm`)
  return { label: "Growth · " + (parts.join(", ") || "recorded"), detail: null }
}

function groupByDate(items: LogItem[]): { dateKey: string; label: string; items: LogItem[] }[] {
  const groups: Record<string, LogItem[]> = {}
  for (const item of items) {
    const key = format(new Date(item.timestamp), "yyyy-MM-dd")
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      const d = new Date(key + "T12:00:00")
      const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEEE, MMMM d")
      return { dateKey: key, label, items }
    })
}

export default function HistoryPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)
  const [babies, setBabies] = useState<Baby[]>([])
  const [items, setItems] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchPage = useCallback(async (
    fid: string, currentFilter: Filter, babyId: string | null, currentOffset: number, append: boolean
  ) => {
    const client = await getAuthedClient()
    if (!client) return
    const from = currentOffset
    const to = currentOffset + PAGE_SIZE - 1
    const fetches = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function applyBabyFilter(q: any) {
      return babyId ? q.eq("baby_id", babyId) : q
    }

    if (currentFilter === "all" || currentFilter === "feeding") {
      fetches.push(
        applyBabyFilter(client.from("feeding_logs").select("*").eq("family_id", fid))
          .order("started_at", { ascending: false }).range(from, to)
          .then(({ data }: { data: any[] | null }) => (data ?? []).map(r => {
            const { label, detail } = feedingLabel(r)
            return { id: r.id, type: "feeding" as const, label, detail, timestamp: r.started_at, notes: r.notes }
          }))
      )
    }
    if (currentFilter === "all" || currentFilter === "sleep") {
      fetches.push(
        applyBabyFilter(client.from("sleep_logs").select("*").eq("family_id", fid))
          .order("started_at", { ascending: false }).range(from, to)
          .then(({ data }: { data: any[] | null }) => (data ?? []).map(r => {
            const { label, detail } = sleepLabel(r)
            return { id: r.id, type: "sleep" as const, label, detail, timestamp: r.started_at, notes: r.notes }
          }))
      )
    }
    if (currentFilter === "all" || currentFilter === "diaper") {
      fetches.push(
        applyBabyFilter(client.from("diaper_logs").select("*").eq("family_id", fid))
          .order("logged_at", { ascending: false }).range(from, to)
          .then(({ data }: { data: any[] | null }) => (data ?? []).map(r => {
            const { label, detail } = diaperLabel(r)
            return { id: r.id, type: "diaper" as const, label, detail, timestamp: r.logged_at, notes: r.notes }
          }))
      )
    }
    if (currentFilter === "all" || currentFilter === "growth") {
      fetches.push(
        applyBabyFilter(client.from("growth_logs").select("*").eq("family_id", fid))
          .order("measured_at", { ascending: false }).range(from, to)
          .then(({ data }: { data: any[] | null }) => (data ?? []).map(r => {
            const { label, detail } = growthLabel(r)
            return { id: r.id, type: "growth" as const, label, detail, timestamp: r.measured_at, notes: r.notes }
          }))
      )
    }

    const results = await Promise.all(fetches)
    const merged = results.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setHasMore(merged.length >= PAGE_SIZE)
    setItems(prev => append ? [...prev, ...merged] : merged)
  }, [])

  useEffect(() => {
    async function init() {
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

      const { data: babiesData } = await client.from("babies").select("id, name").eq("family_id", fid).order("created_at")
      setBabies(babiesData ?? [])

      await fetchPage(fid, "all", null, 0, false)
      setLoading(false)
    }
    init().catch(() => setLoading(false))
  }, [router, fetchPage])

  async function handleFilterChange(f: Filter) {
    if (f === filter) return
    setFilter(f)
    setOffset(0)
    setExpandedId(null)
    setLoading(true)
    try {
      if (familyId) await fetchPage(familyId, f, selectedBabyId, 0, false)
    } finally {
      setLoading(false)
    }
  }

  async function handleBabyChange(babyId: string | null) {
    if (babyId === selectedBabyId) return
    setSelectedBabyId(babyId)
    setOffset(0)
    setExpandedId(null)
    setLoading(true)
    try {
      if (familyId) await fetchPage(familyId, filter, babyId, 0, false)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!familyId) return
    setLoadingMore(true)
    const newOffset = offset + PAGE_SIZE
    try {
      await fetchPage(familyId, filter, selectedBabyId, newOffset, true)
      setOffset(newOffset)
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleDelete(item: LogItem) {
    setDeletingId(item.id)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { error } = await client.from(tableFor[item.type]).delete().eq("id", item.id)
    if (!error) { setItems(prev => prev.filter(i => i.id !== item.id)); setExpandedId(null) }
    setDeletingId(null)
  }

  const groups = groupByDate(items)
  const multipleBabies = babies.length > 1

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Activity</h1>
      </header>

      {/* Type filter */}
      <div className={`px-4 py-2 flex gap-2 overflow-x-auto ${multipleBabies ? "border-b" : "border-b"}`}>
        {(["all", "feeding", "sleep", "diaper", "growth"] as Filter[]).map((f) => (
          <button key={f} onClick={() => handleFilterChange(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize shrink-0 ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {f === "all" ? "All" : `${typeEmoji[f]} ${f.charAt(0).toUpperCase() + f.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Baby filter — only shown when multiple babies */}
      {multipleBabies && (
        <div className="border-b px-4 py-2 flex gap-2 overflow-x-auto">
          <button onClick={() => handleBabyChange(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${selectedBabyId === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            All babies
          </button>
          {babies.map(b => (
            <button key={b.id} onClick={() => handleBabyChange(b.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${selectedBabyId === b.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-4xl">📋</p>
            <p className="text-muted-foreground text-sm">No activity logged yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.dateKey}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
                <div className="space-y-0">
                  {group.items.map((item, i) => {
                    const isExpanded = expandedId === item.id
                    return (
                      <div key={item.id}>
                        {i > 0 && <Separator />}
                        <button className="w-full text-left" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                          <div className="flex items-start justify-between py-3 gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <Badge className={`text-xs font-medium capitalize shrink-0 mt-0.5 ${typeColors[item.type]}`} variant="outline">
                                {item.type}
                              </Badge>
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{item.label}</p>
                                {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                                {item.notes && <p className="text-xs text-muted-foreground italic truncate">{item.notes}</p>}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                              {format(new Date(item.timestamp), "h:mm a")}
                            </span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="pb-3 flex gap-2">
                            <Link href={`/log/edit?id=${item.id}&type=${item.type}`} className="flex-1">
                              <Button variant="outline" size="sm" className="w-full">Edit</Button>
                            </Link>
                            <Button variant="destructive" size="sm" className="flex-1"
                              disabled={deletingId === item.id} onClick={() => handleDelete(item)}>
                              {deletingId === item.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {hasMore && (
              <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
