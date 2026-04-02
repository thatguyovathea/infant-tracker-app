export const PREFS_KEY = "infant-tracker-quick-prefs"

export type QuickPrefs = {
  feeding: { type: string; side: string; amount_ml: string; food_name: string }
  diaper: { type: string }
}

export const DEFAULT_PREFS: QuickPrefs = {
  feeding: { type: "breast", side: "left", amount_ml: "", food_name: "" },
  diaper: { type: "wet" },
}

export type Baby = { id: string; name: string }
export type ActivityItem = { id: string; type: "feeding" | "sleep" | "diaper"; label: string; timestamp: string; babyId: string }
export type ActiveSleep = { id: string; babyId: string; startedAt: string }
export type DailySummary = { babyId: string; feedings: number; sleepMinutes: number; diapers: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TodayLogs = { feedings: any[]; sleeps: any[]; diapers: any[] }
export type WeekDay = { day: string; value: number }

export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]

// ---------- dashboard cache (stale-while-revalidate) ----------
export const DASH_CACHE_KEY = "dash-cache-v3"
export type DashCache = {
  userId: string
  familyId: string
  displayName: string
  babies: Baby[]
  activity: ActivityItem[]
  summaries: DailySummary[]
  todayLogs: TodayLogs
  weekFeedings: WeekDay[]
  weekSleep: WeekDay[]
  unreadCount: number
  prefs: QuickPrefs
}
export function readDashCache(): DashCache | null {
  try {
    const raw = localStorage.getItem(DASH_CACHE_KEY)
    return raw ? (JSON.parse(raw) as DashCache) : null
  } catch { return null }
}
export function saveDashCache(d: DashCache) {
  try { localStorage.setItem(DASH_CACHE_KEY, JSON.stringify(d)) } catch { /* storage full */ }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadLocalPrefs(): QuickPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
  } catch { return DEFAULT_PREFS }
}

export function saveLocalPrefs(prefs: QuickPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadRemotePrefs(client: any, userId: string): Promise<QuickPrefs | null> {
  const { data } = await client.from("user_preferences").select("quick_prefs").eq("user_id", userId).limit(1).maybeSingle()
  if (!data?.quick_prefs) return null
  return { ...DEFAULT_PREFS, ...data.quick_prefs }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveRemotePrefs(client: any, userId: string, prefs: QuickPrefs) {
  await client.from("user_preferences").upsert({ user_id: userId, quick_prefs: prefs, updated_at: new Date().toISOString() })
}

export function feedingLabel(row: Record<string, string>): string {
  if (row.type === "breast") return `Breastfed · ${row.side ?? ""} side`
  if (row.type === "bottle") return row.amount_ml ? `Bottle · ${row.amount_ml}ml` : "Bottle feeding"
  if (row.type === "solid") return `Solids${row.food_name ? ` · ${row.food_name}` : ""}`
  return "Feeding"
}

export function sleepLabel(row: Record<string, string>): string {
  if (row.ended_at) {
    const mins = Math.round((new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 60000)
    return `Slept · ${mins} min`
  }
  return "Sleep started"
}

export function diaperLabel(row: Record<string, string>): string {
  const map: Record<string, string> = { wet: "Wet diaper", dirty: "Dirty diaper", both: "Wet & dirty", dry: "Dry diaper" }
  return map[row.type] ?? "Diaper change"
}

export function feedingPresetLabel(prefs: QuickPrefs["feeding"]): string {
  if (prefs.type === "breast") return `Breast · ${prefs.side} side`
  if (prefs.type === "bottle") return prefs.amount_ml ? `Bottle · ${prefs.amount_ml}ml` : "Bottle"
  if (prefs.type === "solid") return prefs.food_name ? `Solids · ${prefs.food_name}` : "Solids"
  return "Feeding"
}

export function GroupIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="4.5" cy="9" r="2" />
      <path d="M1 21v-1a4 4 0 0 1 4-4h.5" />
      <circle cx="19.5" cy="9" r="2" />
      <path d="M23 21v-1a4 4 0 0 0-4-4h-.5" />
      <circle cx="12" cy="7" r="3" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  )
}
