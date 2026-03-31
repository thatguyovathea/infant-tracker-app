"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"

const PREFS_KEY = "infant-tracker-quick-prefs"

type QuickPrefs = {
  feeding: { type: string; side: string; amount_ml: string; food_name: string }
  diaper: { type: string }
}

const DEFAULT_PREFS: QuickPrefs = {
  feeding: { type: "breast", side: "left", amount_ml: "", food_name: "" },
  diaper: { type: "wet" },
}

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
const DIAPER_TYPES = [
  { value: "wet",   label: "💧 Wet"    },
  { value: "dirty", label: "💩 Dirty"  },
  { value: "both",  label: "💧💩 Both" },
  { value: "dry",   label: "🌵 Dry"    },
]

function OptionButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}>
      {label}
    </button>
  )
}

export default function DefaultsPage() {
  const router = useRouter()
  const [prefs, setPrefs] = useState<QuickPrefs>(DEFAULT_PREFS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      // Start with local prefs immediately
      try {
        const raw = localStorage.getItem(PREFS_KEY)
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })
      } catch {}

      // Then overlay with remote prefs if available
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const client = await getAuthedClient()
      if (!client) return
      const { data } = await client.from("user_preferences").select("quick_prefs").eq("user_id", session.user.id).maybeSingle()
      if (data?.quick_prefs) setPrefs({ ...DEFAULT_PREFS, ...data.quick_prefs })
    }
    load()
  }, [])

  function updateFeeding(patch: Partial<QuickPrefs["feeding"]>) {
    setPrefs(p => ({ ...p, feeding: { ...p.feeding, ...patch } }))
  }

  function updateDiaper(patch: Partial<QuickPrefs["diaper"]>) {
    setPrefs(p => ({ ...p, diaper: { ...p.diaper, ...patch } }))
  }

  async function handleSave() {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const client = await getAuthedClient()
      if (client) await client.from("user_preferences").upsert({ user_id: session.user.id, quick_prefs: prefs, updated_at: new Date().toISOString() })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3 bg-background">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← Back</Button>
        <h1 className="font-semibold">Quick Log Defaults</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Set what gets logged when you tap the quick log buttons on the dashboard. You can always use the ✏️ button to log something different.
        </p>

        {/* Feeding defaults */}
        <Card>
          <CardHeader>
            <CardTitle>🍼 Feeding default</CardTitle>
            <CardDescription>Used when you tap Feeding on the dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {FEEDING_TYPES.map(t => (
                  <OptionButton key={t.value} active={prefs.feeding.type === t.value}
                    onClick={() => updateFeeding({ type: t.value })} label={t.label} />
                ))}
              </div>
            </div>

            {prefs.feeding.type === "breast" && (
              <div className="space-y-2">
                <Label>Side</Label>
                <div className="grid grid-cols-3 gap-2">
                  {SIDES.map(s => (
                    <OptionButton key={s.value} active={prefs.feeding.side === s.value}
                      onClick={() => updateFeeding({ side: s.value })} label={s.label} />
                  ))}
                </div>
              </div>
            )}

            {prefs.feeding.type === "bottle" && (
              <div className="space-y-2">
                <Label>Amount (ml) <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="number" min="0" value={prefs.feeding.amount_ml}
                  onChange={e => updateFeeding({ amount_ml: e.target.value })}
                  placeholder="e.g. 120" />
              </div>
            )}

            {prefs.feeding.type === "solid" && (
              <div className="space-y-2">
                <Label>Food name <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={prefs.feeding.food_name}
                  onChange={e => updateFeeding({ food_name: e.target.value })}
                  placeholder="e.g. Mashed banana" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diaper defaults */}
        <Card>
          <CardHeader>
            <CardTitle>💩 Diaper default</CardTitle>
            <CardDescription>Used when you tap Diaper on the dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {DIAPER_TYPES.map(t => (
                <OptionButton key={t.value} active={prefs.diaper.type === t.value}
                  onClick={() => updateDiaper({ type: t.value })} label={t.label} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={handleSave}>
          {saved ? "Saved!" : "Save defaults"}
        </Button>
      </main>
    </div>
  )
}
