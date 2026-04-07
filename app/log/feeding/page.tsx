"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { useAuthFamily } from "@/lib/use-auth-family"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

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

function FeedingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { babies, familyId, displayName, loading: authLoading } = useAuthFamily()
  const [babyId, setBabyId] = useState("")
  const [feedingType, setFeedingType] = useState(searchParams.get("type") ?? "breast")
  const [side, setSide] = useState("left")
  const [duration, setDuration] = useState("")
  const [amountMl, setAmountMl] = useState("")
  const [foodName, setFoodName] = useState(searchParams.get("food_name") ?? "")
  const [allergenTags] = useState<string[]>((searchParams.get("allergens") ?? "").split(",").filter(Boolean))
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanMessage, setScanMessage] = useState(searchParams.get("food_name") ? `Pre-filled: ${searchParams.get("food_name")}` : "")

  useEffect(() => {
    if (babies.length > 0 && !babyId) setBabyId(babies[0].id)
  }, [babies, babyId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!familyId || !babyId) return
    setLoading(true)
    setError(null)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { data: { session } } = await createClient().auth.getSession()
    const { data: feedRow, error } = await client.from("feeding_logs").insert({
      baby_id: babyId, family_id: familyId, logged_by: session?.user.id,
      type: feedingType,
      side: feedingType === "breast" ? side : null,
      duration_seconds: feedingType !== "solid" && duration ? parseInt(duration) * 60 : null,
      amount_ml: feedingType === "bottle" && amountMl ? parseFloat(amountMl) : null,
      food_name: feedingType === "solid" && foodName ? foodName : null,
      notes: notes || null,
      started_at: new Date().toISOString(),
    }).select("id").single()
    if (error) { setError(error.message); setLoading(false); return }
    // Update quick prefs so dashboard one-tap learns from this
    try {
      const stored = JSON.parse(localStorage.getItem("infant-tracker-quick-prefs") ?? "{}")
      stored.feeding = { type: feedingType, side, amount_ml: amountMl, food_name: foodName }
      localStorage.setItem("infant-tracker-quick-prefs", JSON.stringify(stored))
    } catch {}
    const babyName = babies.find(b => b.id === babyId)?.name ?? "baby"
    const feedLabel = feedingType === "breast" ? "Breast feeding" : feedingType === "bottle" ? `Bottle${amountMl ? ` (${amountMl}ml)` : ""}` : foodName || "Solid food"
    client.from("notifications").insert({
      family_id: familyId, actor_id: session?.user.id, type: "feeding",
      title: `${displayName} logged a feeding`,
      body: `${feedLabel} for ${babyName}`,
      reference_id: feedRow?.id ?? null,
    }).then(({ error: nErr }) => { if (nErr) console.error("[notification]", nErr) })
    router.replace("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3 bg-background" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Log Feeding</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader><CardTitle>Feeding details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
              {scanMessage && <p className="text-xs text-primary font-medium">{scanMessage}</p>}

              {babies.length > 1 && (
                <div className="space-y-2">
                  <Label>Baby</Label>
                  <div className="flex gap-2 flex-wrap">
                    {babies.map(b => (
                      <button key={b.id} type="button" onClick={() => setBabyId(b.id)}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${babyId === b.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}>
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                    <Label>Duration (minutes) <span className="text-muted-foreground">(optional)</span></Label>
                    <Input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 15" />
                  </div>
                </>
              )}

              {feedingType === "bottle" && (
                <>
                  <div className="space-y-2">
                    <Label>Amount (ml) <span className="text-muted-foreground">(optional)</span></Label>
                    <Input type="number" min="0" value={amountMl} onChange={e => setAmountMl(e.target.value)} placeholder="e.g. 120" />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (minutes) <span className="text-muted-foreground">(optional)</span></Label>
                    <Input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 10" />
                  </div>
                </>
              )}

              {feedingType === "solid" && (
                <div className="space-y-2">
                  <Label>Food name <span className="text-muted-foreground">(optional)</span></Label>
                  <Input value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="e.g. Mashed banana" />
                </div>
              )}

              {allergenTags.length > 0 && (
                <div className="space-y-1">
                  <Label>Allergens detected</Label>
                  <div className="flex flex-wrap gap-1">
                    {allergenTags.map(a => (
                      <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it go?" rows={3} />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading || authLoading || !familyId || !babyId}>
                {loading ? "Saving..." : "Save feeding"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </main>
    </div>
  )
}

export default function FeedingPage() {
  return <Suspense><FeedingForm /></Suspense>
}
