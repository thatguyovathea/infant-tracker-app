"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

function toLocalDateTimeValue(iso: string) {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// ─── Feeding ────────────────────────────────────────────────────────────────

const FEEDING_TYPES = [
  { value: "breast", label: "🤱 Breast" },
  { value: "bottle", label: "🍼 Bottle" },
  { value: "solid",  label: "🥣 Solid"  },
]
const SIDES = [
  { value: "left",  label: "Left"  },
  { value: "right", label: "Right" },
  { value: "both",  label: "Both"  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FeedingEdit({ record, onSave }: { record: any; onSave: () => void }) {
  const router = useRouter()
  const [loggedAt, setLoggedAt] = useState(toLocalDateTimeValue(record.started_at))
  const [feedingType, setFeedingType] = useState(record.type ?? "breast")
  const [side, setSide] = useState(record.side ?? "left")
  const [duration, setDuration] = useState(record.duration_seconds ? String(Math.round(record.duration_seconds / 60)) : "")
  const [amountMl, setAmountMl] = useState(record.amount_ml ? String(record.amount_ml) : "")
  const [foodName, setFoodName] = useState(record.food_name ?? "")
  const [notes, setNotes] = useState(record.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }

    const { error } = await client.from("feeding_logs").update({
      started_at: new Date(loggedAt).toISOString(),
      type: feedingType,
      side: feedingType === "breast" ? side : null,
      duration_seconds: feedingType !== "solid" && duration ? parseInt(duration) * 60 : null,
      amount_ml: feedingType === "bottle" && amountMl ? parseFloat(amountMl) : null,
      food_name: feedingType === "solid" && foodName ? foodName : null,
      notes: notes || null,
    }).eq("id", record.id)

    if (error) { setError(error.message); setSaving(false); return }
    onSave()
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader><CardTitle>Edit feeding</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

          <div className="space-y-2">
            <Label>Time</Label>
            <Input type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} required className="text-sm appearance-none" />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {FEEDING_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setFeedingType(t.value)}
                  className={`py-3 px-2 rounded-lg border text-sm font-medium transition-colors ${feedingType === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {feedingType === "breast" && (
            <>
              <div className="space-y-2">
                <Label>Side</Label>
                <div className="grid grid-cols-3 gap-2">
                  {SIDES.map(s => (
                    <button key={s.value} type="button" onClick={() => setSide(s.value)}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${side === s.value ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 15" />
              </div>
            </>
          )}

          {feedingType === "bottle" && (
            <>
              <div className="space-y-2">
                <Label>Amount (ml)</Label>
                <Input type="number" min="0" value={amountMl} onChange={e => setAmountMl(e.target.value)} placeholder="e.g. 120" />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 10" />
              </div>
            </>
          )}

          {feedingType === "solid" && (
            <div className="space-y-2">
              <Label>Food name</Label>
              <Input value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="e.g. Mashed banana" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </CardFooter>
      </Card>
    </form>
  )
}

// ─── Sleep ──────────────────────────────────────────────────────────────────

const QUALITY_OPTIONS = [
  { value: "good", label: "😊 Good" },
  { value: "fair", label: "😐 Fair" },
  { value: "poor", label: "😟 Poor" },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SleepEdit({ record, onSave }: { record: any; onSave: () => void }) {
  const router = useRouter()
  const [startedAt, setStartedAt] = useState(toLocalDateTimeValue(record.started_at))
  const [endedAt, setEndedAt] = useState(record.ended_at ? toLocalDateTimeValue(record.ended_at) : "")
  const [quality, setQuality] = useState(record.quality ?? "good")
  const [notes, setNotes] = useState(record.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    if (endedAt && new Date(endedAt) <= new Date(startedAt)) {
      setError("End time must be after start time.")
      setSaving(false)
      return
    }
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }

    const { error } = await client.from("sleep_logs").update({
      started_at: new Date(startedAt).toISOString(),
      ended_at: endedAt ? new Date(endedAt).toISOString() : null,
      quality,
      notes: notes || null,
    }).eq("id", record.id)

    if (error) { setError(error.message); setSaving(false); return }
    onSave()
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader><CardTitle>Edit sleep</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Start time</Label>
              <Input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} required className="text-sm appearance-none" />
            </div>
            <div className="space-y-2">
              <Label>End time</Label>
              <Input type="datetime-local" value={endedAt} onChange={e => setEndedAt(e.target.value)} className="text-sm appearance-none" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quality</Label>
            <div className="grid grid-cols-3 gap-2">
              {QUALITY_OPTIONS.map(q => (
                <button key={q.value} type="button" onClick={() => setQuality(q.value)}
                  className={`py-3 px-2 rounded-lg border text-sm font-medium transition-colors ${quality === q.value ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </CardFooter>
      </Card>
    </form>
  )
}

// ─── Diaper ─────────────────────────────────────────────────────────────────

const DIAPER_TYPES = [
  { value: "wet",   label: "💧 Wet"      },
  { value: "dirty", label: "💩 Dirty"    },
  { value: "both",  label: "💧💩 Both"   },
  { value: "dry",   label: "🌵 Dry"      },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DiaperEdit({ record, onSave }: { record: any; onSave: () => void }) {
  const router = useRouter()
  const [loggedAt, setLoggedAt] = useState(toLocalDateTimeValue(record.logged_at))
  const [type, setType] = useState(record.type ?? "wet")
  const [notes, setNotes] = useState(record.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }

    const { error } = await client.from("diaper_logs").update({
      logged_at: new Date(loggedAt).toISOString(),
      type,
      notes: notes || null,
    }).eq("id", record.id)

    if (error) { setError(error.message); setSaving(false); return }
    onSave()
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader><CardTitle>Edit diaper</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

          <div className="space-y-2">
            <Label>Time</Label>
            <Input type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} required className="text-sm appearance-none" />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {DIAPER_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`py-3 px-4 rounded-lg border text-sm font-medium transition-colors ${type === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </CardFooter>
      </Card>
    </form>
  )
}

// ─── Page shell ─────────────────────────────────────────────────────────────

function EditForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get("id") ?? ""
  const type = searchParams.get("type") ?? ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const tableFor: Record<string, string> = {
    feeding: "feeding_logs",
    sleep: "sleep_logs",
    diaper: "diaper_logs",
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }

      const table = tableFor[type]
      if (!table) { router.back(); return }

      const client = await getAuthedClient()
      if (!client) { router.replace("/login"); return }

      const { data } = await client.from(table).select("*").eq("id", id).limit(1).maybeSingle()
      if (!data) { router.back(); return }
      setRecord(data)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type])

  function onSave() {
    router.back()
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
        <h1 className="font-semibold">Edit Entry</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        {type === "feeding" && <FeedingEdit record={record} onSave={onSave} />}
        {type === "sleep"   && <SleepEdit   record={record} onSave={onSave} />}
        {type === "diaper"  && <DiaperEdit  record={record} onSave={onSave} />}
      </main>
    </div>
  )
}

export default function EditPage() {
  return <Suspense><EditForm /></Suspense>
}
