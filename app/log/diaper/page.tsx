"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
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

type Baby = { id: string; name: string }

function DiaperForm() {
  const router = useRouter()
  const [babies, setBabies] = useState<Baby[]>([])
  const [babyId, setBabyId] = useState("")
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [type, setType] = useState("wet")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }
      const client = await getAuthedClient()
      if (!client) { router.replace("/login"); return }
      const { data: m } = await client.from("family_members").select("family_id").eq("user_id", session.user.id).limit(1).maybeSingle()
      if (!m) return
      setFamilyId(m.family_id)
      const { data: b } = await client.from("babies").select("id, name").eq("family_id", m.family_id).order("created_at")
      const list = b ?? []
      setBabies(list)
      if (list.length > 0) setBabyId(list[0].id)
    }
    load()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!familyId || !babyId) return
    setLoading(true)
    setError(null)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { data: { session } } = await createClient().auth.getSession()
    const { error } = await client.from("diaper_logs").insert({
      baby_id: babyId, family_id: familyId, logged_by: session?.user.id,
      type, notes: notes || null, logged_at: new Date().toISOString(),
    })
    if (error) { setError(error.message); setLoading(false); return }
    // Update quick prefs so dashboard one-tap learns from this
    try {
      const stored = JSON.parse(localStorage.getItem("infant-tracker-quick-prefs") ?? "{}")
      stored.diaper = { type }
      localStorage.setItem("infant-tracker-quick-prefs", JSON.stringify(stored))
    } catch {}
    router.replace("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3">
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
              <Button type="submit" className="w-full" disabled={loading || !familyId || !babyId}>
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
