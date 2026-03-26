"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { differenceInMonths, differenceInWeeks, format } from "date-fns"
import { useUnits, formatWeight, formatLength } from "@/lib/units"

// ─── Types ────────────────────────────────────────────────────────────────────

type Baby = { id: string; name: string; date_of_birth: string | null }
type Member = { user_id: string; role: string; joined_at: string; display_name: string | null }
type Family = { id: string; name: string; invite_code: string }
type Note = { id: string; content: string; created_at: string }
type GrowthLog = { id: string; measured_at: string; weight_kg: number | null; height_cm: number | null; head_cm: number | null; notes: string | null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Notes Section ────────────────────────────────────────────────────────────

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
      const { data } = await client.from("baby_notes").select("id, content, created_at").eq("baby_id", babyId).order("created_at", { ascending: false })
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
      baby_id: babyId, family_id: familyId, created_by: session?.user.id, content: newNote.trim(),
    }).select("id, content, created_at").single()
    if (!error && data) { setNotes(prev => [data, ...prev]); setNewNote("") }
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
    <div className="space-y-2 pt-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Milestone, visit, note..." className="flex-1 text-sm" />
        <Button type="submit" size="sm" disabled={adding || !newNote.trim()}>{adding ? "..." : "Add"}</Button>
      </form>
      {loading ? <p className="text-xs text-muted-foreground">Loading...</p> : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-1.5">
          {notes.map(note => (
            <div key={note.id} className="flex items-start justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(note.created_at), "MMM d, yyyy · h:mm a")}</p>
              </div>
              <button onClick={() => handleDelete(note.id)} disabled={deletingId === note.id} className="text-muted-foreground hover:text-destructive text-xs shrink-0 mt-0.5 transition-colors">
                {deletingId === note.id ? "..." : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Growth Section ───────────────────────────────────────────────────────────

function GrowthSection({ babyId }: { babyId: string }) {
  const [logs, setLogs] = useState<GrowthLog[]>([])
  const [loading, setLoading] = useState(true)
  const { units } = useUnits()

  useEffect(() => {
    async function load() {
      const client = await getAuthedClient()
      if (!client) return
      const { data } = await client.from("growth_logs").select("id, measured_at, weight_kg, height_cm, head_cm, notes").eq("baby_id", babyId).order("measured_at", { ascending: false }).limit(10)
      setLogs(data ?? [])
      setLoading(false)
    }
    load()
  }, [babyId])

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Little Stats</p>
        <Link href={`/log/growth?babyId=${babyId}`} className="text-xs font-medium text-primary">+ Log measurement</Link>
      </div>
      {loading ? <p className="text-xs text-muted-foreground">Loading...</p> : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No measurements yet.</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map(log => {
            const parts: string[] = []
            if (log.weight_kg != null) parts.push(formatWeight(log.weight_kg, units))
            if (log.height_cm != null) parts.push(formatLength(log.height_cm, units))
            if (log.head_cm != null) parts.push(`head ${formatLength(log.head_cm, units)}`)
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

// ─── Baby Card ────────────────────────────────────────────────────────────────

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
    setSaving(true); setError(null)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { error } = await client.from("babies").update({ name: name.trim(), date_of_birth: dob || null }).eq("id", baby.id)
    if (error) { setError(error.message); setSaving(false); return }
    onSaved({ ...baby, name: name.trim(), date_of_birth: dob || null })
    setEditing(false); setSaving(false)
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
    <div className="bg-muted/30 rounded-xl px-4 py-4 space-y-3">
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
        <Button variant="ghost" size="sm" onClick={() => { setEditing(e => !e); setConfirmDelete(false) }}>
          {editing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="space-y-3 pt-1">
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
            <button type="button" onClick={() => setConfirmDelete(true)} className="w-full text-sm text-destructive text-center py-1">
              Delete {baby.name}&apos;s profile
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive text-center">Permanently delete {baby.name}&apos;s profile and all their logs?</p>
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
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const router = useRouter()

  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [babies, setBabies] = useState<Baby[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  // Add baby form
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDob, setNewDob] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Leave family
  const [confirmLeave, setConfirmLeave] = useState(false)

  // Admin transfer
  const [transferTarget, setTransferTarget] = useState<string | null>(null)
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }
      setCurrentUserId(session.user.id)

      const client = await getAuthedClient()
      if (!client) { router.replace("/login"); return }

      const { data: membership } = await client.from("family_members").select("family_id").eq("user_id", session.user.id).limit(1).maybeSingle()
      if (!membership) { router.replace("/onboarding"); return }

      const [{ data: familyData }, { data: membersData }, { data: babiesData }] = await Promise.all([
        client.from("families").select("id, name, invite_code").eq("id", membership.family_id).limit(1).single(),
        client.from("family_members").select("user_id, role, joined_at, profiles(display_name)").eq("family_id", membership.family_id).order("joined_at", { ascending: true }),
        client.from("babies").select("id, name, date_of_birth").eq("family_id", membership.family_id).order("created_at"),
      ])

      if (familyData) setFamily(familyData)
      setBabies(babiesData ?? [])

      if (membersData?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMembers(membersData.map((m: any) => ({ ...m, display_name: m.profiles?.display_name ?? null })))
      }

      setLoading(false)
    }
    load()
  }, [router])

  async function copyInviteCode() {
    if (!family) return
    try {
      await navigator.clipboard.writeText(family.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — user can copy the code manually
    }
  }

  async function handleAddBaby(e: React.FormEvent) {
    e.preventDefault()
    if (!family) return
    setAdding(true); setAddError(null)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    const { data, error } = await client.from("babies").insert({ name: newName.trim(), family_id: family.id, date_of_birth: newDob || null }).select().single()
    if (error) { setAddError(error.message); setAdding(false); return }
    setBabies(prev => [...prev, data])
    setNewName(""); setNewDob(""); setShowAdd(false); setAdding(false)
  }

  async function transferAdmin(targetUserId: string) {
    if (!currentUserId || !family) return
    setTransferring(true)
    const client = await getAuthedClient()
    if (!client) { router.replace("/login"); return }
    // Promote target to admin
    const { error: promoteErr } = await client.from("family_members").update({ role: "admin" }).eq("user_id", targetUserId).eq("family_id", family.id)
    if (promoteErr) { setTransferring(false); return }
    // Demote self to member
    const { error: demoteErr } = await client.from("family_members").update({ role: "member" }).eq("user_id", currentUserId).eq("family_id", family.id)
    if (demoteErr) {
      // Rollback: demote target back since we couldn't demote self
      await client.from("family_members").update({ role: "member" }).eq("user_id", targetUserId).eq("family_id", family.id)
      setTransferring(false)
      return
    }
    setMembers(prev => prev.map(m => {
      if (m.user_id === targetUserId) return { ...m, role: "admin" }
      if (m.user_id === currentUserId) return { ...m, role: "member" }
      return m
    }))
    setTransferTarget(null)
    setTransferring(false)
  }

  async function leaveFamily() {
    if (!currentUserId || !family) return
    const client = await getAuthedClient()
    if (!client) return
    await client.from("family_members").delete().eq("user_id", currentUserId).eq("family_id", family.id)
    router.replace("/onboarding")
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  )

  const isAdmin = members.find(m => m.user_id === currentUserId)?.role === "admin"

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">{family?.name ?? "Family"}</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">

        {/* ── Babies ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Babies</p>
            <button onClick={() => setShowAdd(v => !v)} className="text-xs font-medium text-primary">
              {showAdd ? "Cancel" : "+ Add baby"}
            </button>
          </div>

          {showAdd && (
            <form onSubmit={handleAddBaby} className="bg-muted/30 rounded-xl px-4 py-4 space-y-3">
              {addError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{addError}</p>}
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Emma" required />
              </div>
              <div className="space-y-1">
                <Label>Date of birth <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="date" value={newDob} onChange={e => setNewDob(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={adding || !newName.trim()}>
                  {adding ? "Adding..." : "Add baby"}
                </Button>
              </div>
            </form>
          )}

          {babies.length === 0 && !showAdd && (
            <p className="text-sm text-muted-foreground">No babies added yet.</p>
          )}

          <div className="space-y-3">
            {babies.map(baby => (
              <BabyCard
                key={baby.id}
                baby={baby}
                familyId={family?.id ?? ""}
                onSaved={updated => setBabies(prev => prev.map(b => b.id === updated.id ? updated : b))}
                onDeleted={id => setBabies(prev => prev.filter(b => b.id !== id))}
              />
            ))}
          </div>
        </section>

        <Separator />

        {/* ── Members ── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Members · {members.length}
          </p>
          <div className="space-y-1">
            {members.map((member, i) => (
              <div key={member.user_id}>
                {i > 0 && <Separator className="my-2" />}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">
                      {member.display_name ?? "Unknown"}
                      {member.user_id === currentUserId && <span className="text-muted-foreground"> (you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && member.role !== "admin" && member.user_id !== currentUserId && (
                      transferTarget === member.user_id ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="destructive" disabled={transferring} onClick={() => transferAdmin(member.user_id)}>
                            {transferring ? "..." : "Confirm"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setTransferTarget(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setTransferTarget(member.user_id)}>
                          Make Admin
                        </Button>
                      )
                    )}
                    <Badge variant={member.role === "admin" ? "default" : "secondary"}>{member.role}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* ── Invite Code ── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Invite Code</p>
          <p className="text-sm text-muted-foreground">Share this code so others can join your family.</p>
          <div className="flex items-center justify-between bg-muted rounded-xl px-4 py-3">
            <span className="font-mono text-xl tracking-widest font-bold">{family?.invite_code}</span>
            <Button size="sm" variant="outline" onClick={copyInviteCode}>{copied ? "Copied!" : "Copy"}</Button>
          </div>
        </section>

        {/* ── Leave Family ── */}
        {!isAdmin && (
          <>
            <Separator />
            <section>
              {!confirmLeave ? (
                <button onClick={() => setConfirmLeave(true)} className="w-full text-sm text-destructive text-center py-2">
                  Leave family
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-destructive text-center">Are you sure you want to leave this family?</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setConfirmLeave(false)}>Cancel</Button>
                    <Button variant="destructive" className="flex-1" onClick={leaveFamily}>Yes, leave</Button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

      </main>
    </div>
  )
}
