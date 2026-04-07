"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { useAuthFamily } from "@/lib/use-auth-family"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const DIAPER_TYPES = [
  { value: "wet",   label: "💧 Wet"    },
  { value: "dirty", label: "💩 Dirty"  },
  { value: "both",  label: "💧💩 Both" },
  { value: "dry",   label: "🌵 Dry"    },
]

function DiaperForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { babies, familyId, displayName, loading: authLoading } = useAuthFamily()
  const [babyId, setBabyId] = useState("")
  const [type, setType] = useState("wet")
  const [notes, setNotes] = useState(searchParams.get("product") ? `Product: ${searchParams.get("product")}` : "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    const { data: diaperRow, error } = await client.from("diaper_logs").insert({
      baby_id: babyId, family_id: familyId, logged_by: session?.user.id,
      type, notes: notes || null, logged_at: new Date().toISOString(),
    }).select("id").single()
    if (error) { setError(error.message); setLoading(false); return }
    // Update quick prefs so dashboard one-tap learns from this
    try {
      const stored = JSON.parse(localStorage.getItem("infant-tracker-quick-prefs") ?? "{}")
      stored.diaper = { type }
      localStorage.setItem("infant-tracker-quick-prefs", JSON.stringify(stored))
    } catch {}
    const babyName = babies.find(b => b.id === babyId)?.name ?? "baby"
    const typeLabel = type === "wet" ? "Wet diaper" : type === "dirty" ? "Dirty diaper" : type === "both" ? "Wet & dirty diaper" : "Dry diaper"
    client.from("notifications").insert({
      family_id: familyId, actor_id: session?.user.id, type: "diaper",
      title: `${displayName} logged a diaper change`,
      body: `${typeLabel} for ${babyName}`,
      reference_id: diaperRow?.id ?? null,
    }).then(({ error: nErr }) => { if (nErr) console.error("[notification]", nErr) })
    router.replace("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3 bg-background" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Log Diaper</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader><CardTitle>Diaper change</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

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
                <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any observations..." rows={3} />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading || authLoading || !familyId || !babyId}>
                {loading ? "Saving..." : "Save diaper change"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </main>
    </div>
  )
}

export default function DiaperPage() {
  return <Suspense><DiaperForm /></Suspense>
}
