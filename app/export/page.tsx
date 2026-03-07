"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format, subDays } from "date-fns"

type Baby = { id: string; name: string }
type Range = 7 | 30 | 90 | 365

const RANGES: { value: Range; label: string }[] = [
  { value: 7,   label: "Last 7 days"  },
  { value: 30,  label: "Last 30 days" },
  { value: 90,  label: "Last 3 months" },
  { value: 365, label: "Last year"    },
]

function escapeCsv(val: string | number | null | undefined): string {
  if (val == null) return ""
  const s = String(val)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escapeCsv(r[h] as string | number | null)).join(",")),
  ]
  return lines.join("\n")
}

function shareOrDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" })
  const file = new File([blob], filename, { type: "text/csv" })

  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: filename }).catch(() => {})
  } else {
    // Desktop fallback
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}

export default function ExportPage() {
  const router = useRouter()
  const [babies, setBabies] = useState<Baby[]>([])
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)
  const [range, setRange] = useState<Range>(30)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null) // "feeding" | "sleep" | "diaper" | "all"

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }
      const client = await getAuthedClient()
      if (!client) { router.replace("/login"); return }
      const { data: m } = await client.from("family_members").select("family_id")
        .eq("user_id", session.user.id).limit(1).maybeSingle()
      if (!m) { router.replace("/onboarding"); return }
      setFamilyId(m.family_id)
      const { data: b } = await client.from("babies").select("id, name")
        .eq("family_id", m.family_id).order("created_at")
      setBabies(b ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  async function runExport(type: "feeding" | "sleep" | "diaper" | "all") {
    if (!familyId) return
    setExporting(type)

    const client = await getAuthedClient()
    if (!client) { setExporting(null); return }

    const fromDate = subDays(new Date(), range)
    fromDate.setHours(0, 0, 0, 0)
    const fromISO = fromDate.toISOString()

    const babyName = selectedBabyId
      ? (babies.find(b => b.id === selectedBabyId)?.name ?? "baby")
      : "all"
    const dateTag = format(new Date(), "yyyy-MM-dd")

    try {
      if (type === "feeding" || type === "all") {
        let q = client.from("feeding_logs")
          .select("id, baby_id, type, side, duration_seconds, amount_ml, food_name, notes, started_at, logged_by")
          .eq("family_id", familyId)
          .gte("started_at", fromISO)
          .order("started_at", { ascending: false })
        if (selectedBabyId) q = q.eq("baby_id", selectedBabyId)
        const { data } = await q
        if (data?.length) {
          const rows = data.map(r => ({
            date: format(new Date(r.started_at), "yyyy-MM-dd"),
            time: format(new Date(r.started_at), "HH:mm"),
            baby_id: r.baby_id,
            type: r.type,
            side: r.side ?? "",
            duration_minutes: r.duration_seconds ? Math.round(r.duration_seconds / 60) : "",
            amount_ml: r.amount_ml ?? "",
            food_name: r.food_name ?? "",
            notes: r.notes ?? "",
          }))
          shareOrDownload(toCsv(rows), `feedings_${babyName}_${dateTag}.csv`)
          if (type === "feeding") { setExporting(null); return }
          await new Promise(r => setTimeout(r, 500)) // small gap between shares
        }
      }

      if (type === "sleep" || type === "all") {
        let q = client.from("sleep_logs")
          .select("id, baby_id, started_at, ended_at, quality, notes")
          .eq("family_id", familyId)
          .gte("started_at", fromISO)
          .order("started_at", { ascending: false })
        if (selectedBabyId) q = q.eq("baby_id", selectedBabyId)
        const { data } = await q
        if (data?.length) {
          const rows = data.map(r => ({
            date: format(new Date(r.started_at), "yyyy-MM-dd"),
            start_time: format(new Date(r.started_at), "HH:mm"),
            end_time: r.ended_at ? format(new Date(r.ended_at), "HH:mm") : "",
            duration_minutes: r.ended_at
              ? Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000)
              : "",
            baby_id: r.baby_id,
            quality: r.quality,
            notes: r.notes ?? "",
          }))
          shareOrDownload(toCsv(rows), `sleep_${babyName}_${dateTag}.csv`)
          if (type === "sleep") { setExporting(null); return }
          await new Promise(r => setTimeout(r, 500))
        }
      }

      if (type === "diaper" || type === "all") {
        let q = client.from("diaper_logs")
          .select("id, baby_id, type, notes, logged_at")
          .eq("family_id", familyId)
          .gte("logged_at", fromISO)
          .order("logged_at", { ascending: false })
        if (selectedBabyId) q = q.eq("baby_id", selectedBabyId)
        const { data } = await q
        if (data?.length) {
          const rows = data.map(r => ({
            date: format(new Date(r.logged_at), "yyyy-MM-dd"),
            time: format(new Date(r.logged_at), "HH:mm"),
            baby_id: r.baby_id,
            type: r.type,
            notes: r.notes ?? "",
          }))
          shareOrDownload(toCsv(rows), `diapers_${babyName}_${dateTag}.csv`)
        }
      }
    } finally {
      setExporting(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  )

  const multipleBabies = babies.length > 1

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Export Data</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Date range */}
        <Card>
          <CardHeader><CardTitle>Date range</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {RANGES.map(r => (
                <button key={r.value} type="button" onClick={() => setRange(r.value)}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    range === r.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Baby filter */}
        {multipleBabies && (
          <Card>
            <CardHeader><CardTitle>Baby</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setSelectedBabyId(null)}
                  className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    selectedBabyId === null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  }`}>
                  All babies
                </button>
                {babies.map(b => (
                  <button key={b.id} type="button" onClick={() => setSelectedBabyId(b.id)}
                    className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                      selectedBabyId === b.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-input"
                    }`}>
                    {b.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export buttons */}
        <Card>
          <CardHeader><CardTitle>Export as CSV</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground pb-1">
              Each export opens the iOS share sheet so you can save to Files, email, AirDrop, or open in Excel.
            </p>
            <Button className="w-full" variant="outline"
              disabled={!!exporting}
              onClick={() => runExport("feeding")}>
              {exporting === "feeding" ? "Exporting..." : "🤱 Feeding logs"}
            </Button>
            <Button className="w-full" variant="outline"
              disabled={!!exporting}
              onClick={() => runExport("sleep")}>
              {exporting === "sleep" ? "Exporting..." : "😴 Sleep logs"}
            </Button>
            <Button className="w-full" variant="outline"
              disabled={!!exporting}
              onClick={() => runExport("diaper")}>
              {exporting === "diaper" ? "Exporting..." : "💩 Diaper logs"}
            </Button>
            <div className="pt-2">
              <Button className="w-full"
                disabled={!!exporting}
                onClick={() => runExport("all")}>
                {exporting === "all" ? "Exporting..." : "Export all (3 files)"}
              </Button>
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  )
}
