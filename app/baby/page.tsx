"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { differenceInMonths, differenceInWeeks, format } from "date-fns"
import Link from "next/link"

function calcAge(dob: string): string {
  const birth = new Date(dob)
  const now = new Date()
  const months = differenceInMonths(now, birth)
  if (months < 1) {
    const weeks = differenceInWeeks(now, birth)
    return `${weeks} week${weeks !== 1 ? "s" : ""} old`
  }
  if (months < 24) return `${months} month${months !== 1 ? "s" : ""} old`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}y ${rem}mo old` : `${years} years old`
}

type Baby = { id: string; name: string; date_of_birth: string | null }
type Note = { id: string; content: string; created_at: string }

function NotesSection({ babyId, familyId }: { babyId: string; familyId: string }) {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState("")
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const client = await getAuthedClient()
      if (!client) return
      const { data } = await client
        .from("baby_notes")
        .select("id, content, created_at")
        .eq("baby_id", babyId)
        .order("created_at", { ascending: false })
      setNotes(data ?? [])
      setLoading(false)
    }
    load()
  }, [babyId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newNote.trim()) return
    setAdding(true)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { data: { session } } = await createClient().auth.getSession()
    const { data, error } = await client.from("baby_notes").insert({
      baby_id: babyId,
      family_id: familyId,
      created_by: session?.user.id,
      content: newNote.trim(),
    }).select("id, content, created_at").single()
    if (!error && data) {
      setNotes(prev => [data, ...prev])
      setNewNote("")
    }
    setAdding(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { error } = await client.from("baby_notes").delete().eq("id", id)
    if (!error) setNotes(prev => prev.filter(n => n.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="space-y-3 pt-2">
      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>

      {/* Add note */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="Add a note, milestone, or visit..."
          className="flex-1 text-sm"
        />
        <Button type="submit" size="sm" disabled={adding || !newNote.trim()}>
          {adding ? "..." : "Add"}
        </Button>
      </form>

      {/* Notes list */}
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="flex items-start justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(note.created_at), "MMM d, yyyy · h:mm a")}</p>
              </div>
              <button
                onClick={() => handleDelete(note.id)}
                disabled={deletingId === note.id}
                className="text-muted-foreground hover:text-destructive text-xs shrink-0 mt-0.5 transition-colors"
              >
                {deletingId === note.id ? "..." : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type GrowthLog = { id: string; measured_at: string; weight_kg: number | null; height_cm: number | null; head_cm: number | null; notes: string | null }

function GrowthSection({ babyId }: { babyId: string }) {
  const [logs, setLogs] = useState<GrowthLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const client = await getAuthedClient()
      if (!client) return
      const { data } = await client
        .from("growth_logs")
        .select("id, measured_at, weight_kg, height_cm, head_cm, notes")
        .eq("baby_id", babyId)
        .order("measured_at", { ascending: false })
        .limit(10)
      setLogs(data ?? [])
      setLoading(false)
    }
    load()
  }, [babyId])

  return (
    <div className="space-y-3 pt-2">
      <Separator />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Little Stats</p>
        <Link href={`/log/growth?babyId=${babyId}`}
          className="text-xs font-medium text-primary">
          + Log measurement
        </Link>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No measurements yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const parts: string[] = []
            if (log.weight_kg != null) parts.push(`${log.weight_kg} kg`)
            if (log.height_cm != null) parts.push(`${log.height_cm} cm`)
            if (log.head_cm != null) parts.push(`head ${log.head_cm} cm`)
            return (
              <div key={log.id} className="bg-muted/40 rounded-lg px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{parts.join(" · ")}</p>
                  <p className="text-xs text-muted-foreground shrink-0">{format(new Date(log.measured_at), "MMM d, yyyy")}</p>
                </div>
                {log.notes && <p className="text-xs text-muted-foreground mt-0.5">{log.notes}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BabyCard({ baby, familyId, onSaved, onDeleted }: { baby: Baby; familyId: string; onSaved: (updated: Baby) => void; onDeleted: (id: string) => void }) {
  const router = useRouter()
  const [name, setName] = useState(baby.name)
  const [dob, setDob] = useState(baby.date_of_birth ?? "")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { error } = await client.from("babies").update({ name: name.trim(), date_of_birth: dob || null }).eq("id", baby.id)
    if (error) { setError(error.message); setSaving(false); return }
    onSaved({ ...baby, name: name.trim(), date_of_birth: dob || null })
    setEditing(false)
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { error } = await client.from("babies").delete().eq("id", baby.id)
    if (error) { setError(error.message); setDeleting(false); return }
    onDeleted(baby.id)
  }

  const ageLabel = dob ? calcAge(dob) : null
  const dobDisplay = dob ? format(new Date(dob), "MMMM d, yyyy") : null

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">👶</span>
            <div>
              <p className="font-semibold">{baby.name}</p>
              {ageLabel && <p className="text-xs text-muted-foreground">{ageLabel}</p>}
              {dobDisplay && <p className="text-xs text-muted-foreground">Born {dobDisplay}</p>}
              {!dob && <p className="text-xs text-muted-foreground">No birthdate set</p>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(e => !e)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        </div>

        {editing && (
          <form onSubmit={handleSave} className="space-y-3 pt-2">
            <Separator />
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Date of birth <span className="text-muted-foreground">(optional)</span></Label>
              <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
            <Separator />
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="w-full text-sm text-destructive text-center py-1">
                Delete {baby.name}&apos;s profile
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-destructive text-center">This will permanently delete {baby.name}&apos;s profile and all their logs. Are you sure?</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button type="button" variant="destructive" className="flex-1" disabled={deleting} onClick={handleDelete}>
                    {deleting ? "Deleting..." : "Yes, delete"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}

        <GrowthSection babyId={baby.id} />
        <NotesSection babyId={baby.id} familyId={familyId} />
      </CardContent>
    </Card>
  )
}

export default function BabiesPage() {
  const router = useRouter()
  const [babies, setBabies] = useState<Baby[]>([])
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDob, setNewDob] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

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
      const { data } = await client.from("babies").select("id, name, date_of_birth").eq("family_id", m.family_id).order("created_at")
      setBabies(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!familyId) return
    setAdding(true)
    setAddError(null)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { data, error } = await client.from("babies").insert({ name: newName.trim(), family_id: familyId, date_of_birth: newDob || null }).select().single()
    if (error) { setAddError(error.message); setAdding(false); return }
    setBabies(prev => [...prev, data])
    setNewName("")
    setNewDob("")
    setShowAdd(false)
    setAdding(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Babies</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {babies.map(baby => (
          <BabyCard
            key={baby.id}
            baby={baby}
            familyId={familyId!}
            onSaved={updated => setBabies(prev => prev.map(b => b.id === updated.id ? updated : b))}
            onDeleted={id => setBabies(prev => prev.filter(b => b.id !== id))}
          />
        ))}

        {showAdd ? (
          <Card>
            <CardHeader><CardTitle>Add baby</CardTitle></CardHeader>
            <form onSubmit={handleAdd}>
              <CardContent className="space-y-4">
                {addError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{addError}</p>}
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Emma" required />
                </div>
                <div className="space-y-2">
                  <Label>Date of birth <span className="text-muted-foreground">(optional)</span></Label>
                  <Input type="date" value={newDob} onChange={e => setNewDob(e.target.value)} />
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={adding || !newName.trim()}>
                  {adding ? "Adding..." : "Add baby"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
            + Add baby
          </Button>
        )}
      </main>
    </div>
  )
}
