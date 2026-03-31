"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { useUnits, lbsToKg, inToCm, weightLabel, lengthLabel } from "@/lib/units"

type Baby = { id: string; name: string }

function GrowthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedBabyId = searchParams.get("babyId")
  const { units } = useUnits()

  const [babies, setBabies] = useState<Baby[]>([])
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [babyId, setBabyId] = useState<string>("")
  const [measuredAt, setMeasuredAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [weight, setWeight] = useState("")
  const [height, setHeight] = useState("")
  const [head, setHead] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
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
      const first = preselectedBabyId ?? babiesData?.[0]?.id ?? ""
      setBabyId(first)
      setLoading(false)
    }
    load()
  }, [router, preselectedBabyId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!familyId || !babyId) return
    if (!weight && !height && !head) { setError("Enter at least one measurement."); return }
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const client = await getAuthedClient()
    if (!client || !session) { router.replace("/login"); return }

    // Always store in metric
    const weight_kg = weight ? (units === "imperial" ? lbsToKg(parseFloat(weight)) : parseFloat(weight)) : null
    const height_cm = height ? (units === "imperial" ? inToCm(parseFloat(height)) : parseFloat(height)) : null
    const head_cm = head ? (units === "imperial" ? inToCm(parseFloat(head)) : parseFloat(head)) : null

    const { error: err } = await client.from("growth_logs").insert({
      baby_id: babyId,
      family_id: familyId,
      logged_by: session.user.id,
      measured_at: new Date(measuredAt).toISOString(),
      weight_kg: weight_kg ? parseFloat(weight_kg.toFixed(3)) : null,
      height_cm: height_cm ? parseFloat(height_cm.toFixed(1)) : null,
      head_cm: head_cm ? parseFloat(head_cm.toFixed(1)) : null,
      notes: notes.trim() || null,
    })

    if (err) { setError(err.message); setSaving(false); return }
    router.back()
  }

  const wLabel = weightLabel(units)
  const lLabel = lengthLabel(units)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3 bg-background" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Log Little Stats</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

          {babies.length > 1 && (
            <div className="space-y-1.5">
              <Label>Baby</Label>
              <div className="flex gap-2 flex-wrap">
                {babies.map(b => (
                  <button key={b.id} type="button" onClick={() => setBabyId(b.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${babyId === b.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Date & time</Label>
            <Input type="datetime-local" value={measuredAt} onChange={e => setMeasuredAt(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Weight <span className="text-muted-foreground font-normal">({wLabel})</span></Label>
              <Input
                type="number"
                step={units === "imperial" ? "0.1" : "0.001"}
                min="0"
                max={units === "imperial" ? "66" : "30"}
                placeholder={units === "imperial" ? "7.5" : "3.520"}
                value={weight}
                onChange={e => setWeight(e.target.value)}
              />
              {weight && units === "metric" && (
                <p className="text-xs text-muted-foreground">{Math.round(parseFloat(weight) * 1000)}g · {(parseFloat(weight) * 2.205).toFixed(1)} lbs</p>
              )}
              {weight && units === "imperial" && (
                <p className="text-xs text-muted-foreground">{(lbsToKg(parseFloat(weight))).toFixed(2)} kg</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Height <span className="text-muted-foreground font-normal">({lLabel})</span></Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max={units === "imperial" ? "60" : "150"}
                placeholder={units === "imperial" ? "21.5" : "55.0"}
                value={height}
                onChange={e => setHeight(e.target.value)}
              />
              {height && units === "metric" && (
                <p className="text-xs text-muted-foreground">{(parseFloat(height) / 2.54).toFixed(1)} in</p>
              )}
              {height && units === "imperial" && (
                <p className="text-xs text-muted-foreground">{inToCm(parseFloat(height)).toFixed(1)} cm</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Head <span className="text-muted-foreground font-normal">({lLabel})</span></Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max={units === "imperial" ? "24" : "60"}
                placeholder={units === "imperial" ? "14.0" : "36.0"}
                value={head}
                onChange={e => setHead(e.target.value)}
              />
              {head && units === "metric" && (
                <p className="text-xs text-muted-foreground">{(parseFloat(head) / 2.54).toFixed(1)} in</p>
              )}
              {head && units === "imperial" && (
                <p className="text-xs text-muted-foreground">{inToCm(parseFloat(head)).toFixed(1)} cm</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input placeholder="e.g. 2-month checkup" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save measurement"}
          </Button>
        </form>
      </main>
    </div>
  )
}

export default function GrowthPage() {
  return (
    <Suspense>
      <GrowthForm />
    </Suspense>
  )
}
