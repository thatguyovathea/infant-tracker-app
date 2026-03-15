"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const QUALITY_OPTIONS = [
  { value: "good", label: "😊 Good" },
  { value: "fair", label: "😐 Fair" },
  { value: "poor", label: "😟 Poor" },
]

function toLocalDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

type Baby = { id: string; name: string }

function SleepForm() {
  const router = useRouter()
  const now = new Date()
  const [babies, setBabies] = useState<Baby[]>([])
  const [babyId, setBabyId] = useState("")
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [startedAt, setStartedAt] = useState(toLocalDateTimeValue(now))
  const [endedAt, setEndedAt] = useState("")
  const [quality, setQuality] = useState("good")
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
      const [{ data: b }, { data: profile }] = await Promise.all([
        client.from("babies").select("id, name").eq("family_id", m.family_id).order("created_at"),
        client.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle(),
      ])
      const list = b ?? []
      setBabies(list)
      if (list.length > 0) setBabyId(list[0].id)
      setDisplayName(profile?.display_name ?? "Someone")
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
    const endedAtISO = endedAt ? new Date(endedAt).toISOString() : null
    const { data: sleepRow, error } = await client.from("sleep_logs").insert({
      baby_id: babyId, family_id: familyId, logged_by: session?.user.id,
      started_at: new Date(startedAt).toISOString(),
      ended_at: endedAtISO,
      quality,
      notes: notes || null,
    }).select("id").single()
    if (error) { setError(error.message); setLoading(false); return }
    const babyName = babies.find(b => b.id === babyId)?.name ?? "baby"
    client.from("notifications").insert({
      family_id: familyId, actor_id: session?.user.id, type: "sleep",
      title: endedAtISO ? `${displayName} logged sleep` : `${displayName} started sleep`,
      body: endedAtISO ? `${babyName} slept` : `${babyName} is now sleeping`,
      reference_id: sleepRow?.id ?? null,
    }).then(() => {}).catch(err => console.error("[notification]", err))
    router.replace("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Log Sleep</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader><CardTitle>Sleep session</CardTitle></CardHeader>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>End time <span className="text-muted-foreground">(optional)</span></Label>
                  <Input type="datetime-local" value={endedAt} onChange={e => setEndedAt(e.target.value)} />
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
                <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did they sleep?" rows={3} />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading || !familyId || !babyId}>
                {loading ? "Saving..." : "Save sleep"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </main>
    </div>
  )
}

export default function SleepPage() {
  return <Suspense><SleepForm /></Suspense>
}
