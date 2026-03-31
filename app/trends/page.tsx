"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { format, subDays, eachDayOfInterval, differenceInMinutes } from "date-fns"
import { useUnits, kgToLbs, cmToIn, weightLabel, lengthLabel } from "@/lib/units"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Dot
} from "recharts"

type Range = 7 | 14 | 30
type Baby = { id: string; name: string }
type GrowthPoint = { date: string; weight_kg: number | null; height_cm: number | null; head_cm: number | null }

type DayData = {
  date: string      // "Mon", "Tue" etc or "Mar 1"
  dateKey: string   // "yyyy-MM-dd"
  sleepMins: number
  feedings: number
  diapers: number
}

function buildDayMap(range: Range): DayData[] {
  const today = new Date()
  const days = eachDayOfInterval({ start: subDays(today, range - 1), end: today })
  return days.map(d => ({
    date: range <= 7 ? format(d, "EEE") : format(d, "M/d"),
    dateKey: format(d, "yyyy-MM-dd"),
    sleepMins: 0,
    feedings: 0,
    diapers: 0,
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-medium mb-1">{label}</p>
      <p>{payload[0].value}{unit}</p>
    </div>
  )
}

export default function TrendsPage() {
  const router = useRouter()
  const [range, setRange] = useState<Range>(7)
  const [babies, setBabies] = useState<Baby[]>([])
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)
  const [data, setData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [growthData, setGrowthData] = useState<GrowthPoint[]>([])

  type CorrelationPoint = { type: string; latencyMins: number; durationMins: number; count: number }
  const [correlationData, setCorrelationData] = useState<CorrelationPoint[]>([])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }
      const client = await getAuthedClient()
      if (!client) { router.replace("/login"); return }
      const { data: m } = await client.from("family_members").select("family_id").eq("user_id", session.user.id).limit(1).maybeSingle()
      if (!m) { router.replace("/onboarding"); return }
      setFamilyId(m.family_id)
      const { data: babiesData } = await client.from("babies").select("id, name").eq("family_id", m.family_id).order("created_at")
      setBabies(babiesData ?? [])
    }
    init().catch(() => {})
  }, [router])

  useEffect(() => {
    if (!familyId) return
    async function fetch() {
      setLoading(true)
      const client = await getAuthedClient()
      if (!client) return
      const from = subDays(new Date(), range - 1)
      from.setHours(0, 0, 0, 0)
      const fromISO = from.toISOString()

      let feedQ = client.from("feeding_logs").select("started_at, ended_at, type, baby_id").eq("family_id", familyId!).gte("started_at", fromISO)
      let sleepQ = client.from("sleep_logs").select("started_at, ended_at, baby_id").eq("family_id", familyId!).gte("started_at", fromISO)
      let diaperQ = client.from("diaper_logs").select("logged_at, baby_id").eq("family_id", familyId!).gte("logged_at", fromISO)

      if (selectedBabyId) {
        feedQ = feedQ.eq("baby_id", selectedBabyId)
        sleepQ = sleepQ.eq("baby_id", selectedBabyId)
        diaperQ = diaperQ.eq("baby_id", selectedBabyId)
      }

      let growthQ = client.from("growth_logs")
        .select("measured_at, weight_kg, height_cm, head_cm")
        .eq("family_id", familyId!)
        .gte("measured_at", fromISO)
        .order("measured_at", { ascending: true })
      if (selectedBabyId) growthQ = growthQ.eq("baby_id", selectedBabyId)

      const [{ data: feedings }, { data: sleeps }, { data: diapers }, { data: growth }] = await Promise.all([feedQ, sleepQ, diaperQ, growthQ])

      const map = buildDayMap(range)
      const byKey = Object.fromEntries(map.map(d => [d.dateKey, d]))

      feedings?.forEach(r => {
        const k = format(new Date(r.started_at), "yyyy-MM-dd")
        if (byKey[k]) byKey[k].feedings++
      })
      diapers?.forEach(r => {
        const k = format(new Date(r.logged_at), "yyyy-MM-dd")
        if (byKey[k]) byKey[k].diapers++
      })
      sleeps?.forEach(r => {
        const k = format(new Date(r.started_at), "yyyy-MM-dd")
        if (!byKey[k]) return
        const end = r.ended_at ? new Date(r.ended_at) : new Date()
        byKey[k].sleepMins += differenceInMinutes(end, new Date(r.started_at))
      })

      setData(map)
      setGrowthData((growth ?? []).map(r => ({
        date: format(new Date(r.measured_at), "M/d"),
        weight_kg: r.weight_kg,
        height_cm: r.height_cm,
        head_cm: r.head_cm,
      })))
      // Feed → Sleep correlation
      const CORR_WINDOW = 90  // minutes
      const CORR_MIN = 3      // minimum pairings to show a bar
      type Acc = { latencySum: number; durationSum: number; durCount: number; count: number }
      const acc: Record<string, Acc> = {
        breast: { latencySum: 0, durationSum: 0, durCount: 0, count: 0 },
        bottle: { latencySum: 0, durationSum: 0, durCount: 0, count: 0 },
        solid:  { latencySum: 0, durationSum: 0, durCount: 0, count: 0 },
      }
      sleeps?.forEach(sl => {
        if (!sl.started_at) return
        const sleepStart = new Date(sl.started_at)
        const sleepEnd   = sl.ended_at ? new Date(sl.ended_at) : null
        const candidates = (feedings ?? []).filter(f =>
          f.baby_id === sl.baby_id &&
          f.ended_at != null &&
          new Date(f.ended_at) <= sleepStart &&
          differenceInMinutes(sleepStart, new Date(f.ended_at)) <= CORR_WINDOW
        )
        if (!candidates.length) return
        const best = candidates.reduce((a, b) =>
          new Date(a.ended_at!) > new Date(b.ended_at!) ? a : b
        )
        const t = best.type as string
        if (!(t in acc)) return
        acc[t].latencySum += differenceInMinutes(sleepStart, new Date(best.ended_at!))
        acc[t].count++
        if (sleepEnd) {
          acc[t].durationSum += differenceInMinutes(sleepEnd, sleepStart)
          acc[t].durCount++
        }
      })
      const corrResult: CorrelationPoint[] = (["breast", "bottle", "solid"] as const)
        .filter(t => acc[t].count >= CORR_MIN)
        .map(t => ({
          type: t.charAt(0).toUpperCase() + t.slice(1),
          latencyMins:  Math.round(acc[t].latencySum / acc[t].count),
          durationMins: acc[t].durCount > 0 ? Math.round(acc[t].durationSum / acc[t].durCount) : 0,
          count: acc[t].count,
        }))
      setCorrelationData(corrResult)

      setLoading(false)
    }
    fetch().catch(() => setLoading(false))
  }, [familyId, range, selectedBabyId])

  const { units } = useUnits()
  const multipleBabies = babies.length > 1

  function sleepTick(mins: number) {
    if (mins === 0) return "0"
    const h = Math.floor(mins / 60), m = mins % 60
    return h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`
  }

  function sleepLabel(mins: number) {
    const h = Math.floor(mins / 60), m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3 bg-background" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Trends</h1>
      </header>

      {/* Range selector */}
      <div className="border-b px-4 py-2 flex gap-2">
        {([7, 14, 30] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${range === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {r}d
          </button>
        ))}
      </div>

      {/* Baby filter */}
      {multipleBabies && (
        <div className="border-b px-4 py-2 flex gap-2 overflow-x-auto">
          <button onClick={() => setSelectedBabyId(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${selectedBabyId === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            All babies
          </button>
          {babies.map(b => (
            <button key={b.id} onClick={() => setSelectedBabyId(b.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${selectedBabyId === b.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        ) : (
          <>
            {/* Feeding */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">🍼 Feeding</h2>
                <p className="text-xs text-muted-foreground">
                  Avg {(data.reduce((a, d) => a + d.feedings, 0) / data.filter(d => d.feedings > 0).length || 0).toFixed(1)} / day
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data} barSize={range <= 7 ? 28 : range <= 14 ? 16 : 10}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip content={<CustomTooltip unit=" feedings" />} />
                    <Bar dataKey="feedings" radius={[4, 4, 0, 0]}>
                      {data.map((d) => <Cell key={d.date} fill="rgb(56 189 248 / 0.7)" />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sleep */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">😴 Sleep</h2>
                <p className="text-xs text-muted-foreground">
                  Avg {sleepLabel(Math.round(data.reduce((a, d) => a + d.sleepMins, 0) / data.filter(d => d.sleepMins > 0).length || 0))} / day
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data} barSize={range <= 7 ? 28 : range <= 14 ? 16 : 10}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={sleepTick} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<CustomTooltip unit="" />} formatter={(v: number) => sleepLabel(v)} />
                    <Bar dataKey="sleepMins" radius={[4, 4, 0, 0]}>
                      {data.map((d) => <Cell key={d.date} fill="rgb(167 139 250 / 0.7)" />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Growth */}
            {growthData.length > 0 && (() => {
              const wUnit = weightLabel(units)
              const lUnit = lengthLabel(units)
              const latestWeight = growthData[growthData.length - 1].weight_kg
              const weightChartData = growthData
                .filter(d => d.weight_kg != null)
                .map(d => ({ ...d, weight_val: units === "imperial" ? parseFloat(kgToLbs(d.weight_kg!).toFixed(1)) : d.weight_kg! }))
              const heightChartData = growthData
                .filter(d => d.height_cm != null)
                .map(d => ({ ...d, height_val: units === "imperial" ? parseFloat(cmToIn(d.height_cm!).toFixed(1)) : d.height_cm! }))
              return (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-semibold">📏 Little Stats</h2>
                    {latestWeight != null && (
                      <p className="text-xs text-muted-foreground">
                        Latest {units === "imperial" ? `${kgToLbs(latestWeight).toFixed(1)} lbs` : `${latestWeight} kg`}
                      </p>
                    )}
                  </div>
                  {weightChartData.length > 0 && (
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-xs text-muted-foreground mb-2">Weight ({wUnit})</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={weightChartData}>
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36}
                            domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} />
                          <Tooltip content={<CustomTooltip unit={` ${wUnit}`} />} />
                          <Line dataKey="weight_val" type="monotone" stroke="rgb(16 185 129)" strokeWidth={2}
                            dot={<Dot r={4} fill="rgb(16 185 129)" />} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {heightChartData.length > 0 && (
                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-xs text-muted-foreground mb-2">Height ({lUnit})</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={heightChartData}>
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36}
                            domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} />
                          <Tooltip content={<CustomTooltip unit={` ${lUnit}`} />} />
                          <Line dataKey="height_val" type="monotone" stroke="rgb(99 102 241)" strokeWidth={2}
                            dot={<Dot r={4} fill="rgb(99 102 241)" />} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Feed → Sleep Correlation */}
            {correlationData.length >= 2 ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-semibold">Feed → Sleep</h2>
                  <p className="text-xs text-muted-foreground">{range}d · {correlationData.length} feeding types</p>
                </div>
                <div className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground">Time to sleep after feed</p>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={correlationData} barSize={40}>
                        <XAxis dataKey="type" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={sleepTick} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip content={<CustomTooltip unit=" min" />} />
                        <Bar dataKey="latencyMins" radius={[4, 4, 0, 0]}>
                          {correlationData.map(d => <Cell key={d.type} fill="rgb(167 139 250 / 0.7)" />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground">Sleep duration after feed</p>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={correlationData} barSize={40}>
                        <XAxis dataKey="type" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={sleepTick} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip content={<CustomTooltip unit=" min" />} />
                        <Bar dataKey="durationMins" radius={[4, 4, 0, 0]}>
                          {correlationData.map(d => <Cell key={d.type} fill="rgb(56 189 248 / 0.7)" />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="font-semibold">Feed → Sleep</h2>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Not enough data yet — try a longer date range
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
