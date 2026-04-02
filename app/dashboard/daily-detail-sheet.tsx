"use client"

import { format } from "date-fns"
import { feedingLabel, diaperLabel } from "./types"
import type { TodayLogs } from "./types"

interface DailyDetailSheetProps {
  sheet: { type: "feeding" | "sleep" | "diaper"; babyId: string }
  setSheet: (v: { type: "feeding" | "sleep" | "diaper"; babyId: string } | null) => void
  todayLogs: TodayLogs
  babyMap: Record<string, string>
  multipleBabies: boolean
}

export function DailyDetailSheet({ sheet, setSheet, todayLogs, babyMap, multipleBabies }: DailyDetailSheetProps) {
  const s = sheet
  const typeLabel = s.type === "feeding" ? "Feedings" : s.type === "sleep" ? "Sleep" : "Diapers"
  const babyName = multipleBabies ? babyMap[s.babyId] : null
  const rows = s.type === "feeding" ? todayLogs.feedings.filter(r => r.baby_id === s.babyId)
    : s.type === "sleep" ? todayLogs.sleeps.filter(r => r.baby_id === s.babyId)
    : todayLogs.diapers.filter(r => r.baby_id === s.babyId)

  function rowLabel(r: Record<string, string>): string {
    if (s.type === "feeding") return feedingLabel(r)
    if (s.type === "diaper") return diaperLabel(r)
    if (r.ended_at) { const mins = Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000); const h = Math.floor(mins / 60), m = mins % 60; return h > 0 ? `Slept · ${h}h ${m}m` : `Slept · ${m} min` }
    return "Sleep in progress"
  }
  function rowTime(r: Record<string, string>): string { return format(new Date(s.type === "diaper" ? r.logged_at : r.started_at), "h:mm a") }
  function rowDetail(r: Record<string, string>): string | null {
    if (s.type === "sleep" && r.ended_at) return `${format(new Date(r.started_at), "h:mm a")} – ${format(new Date(r.ended_at), "h:mm a")}`
    if (s.type === "sleep" && !r.ended_at) return "Still sleeping"
    if (s.type === "feeding" && r.type === "breast" && r.duration_seconds) return `${Math.round(Number(r.duration_seconds) / 60)} min`
    if (s.type === "feeding" && r.notes) return r.notes
    return null
  }

  let totalLine = ""
  if (s.type === "sleep") {
    const totalMins = rows.reduce((acc: number, r: Record<string, string>) => acc + Math.round(((r.ended_at ? new Date(r.ended_at) : new Date()).getTime() - new Date(r.started_at).getTime()) / 60000), 0)
    const h = Math.floor(totalMins / 60), m = totalMins % 60
    totalLine = h > 0 ? `${h}h ${m}m total sleep` : `${m}m total sleep`
  } else if (s.type === "diaper") {
    totalLine = `${rows.length} change${rows.length !== 1 ? "s" : ""} today`
  } else {
    const totalMl = rows.reduce((acc: number, r: Record<string, string>) => acc + (r.amount_ml ? Number(r.amount_ml) : 0), 0)
    const totalBreastMins = rows.reduce((acc: number, r: Record<string, string>) => acc + (r.type === "breast" && r.duration_seconds ? Math.round(Number(r.duration_seconds) / 60) : 0), 0)
    const parts = [`${rows.length} feeding${rows.length !== 1 ? "s" : ""}`]
    if (totalMl > 0) parts.push(`${totalMl}ml total`)
    if (totalBreastMins > 0) { const h = Math.floor(totalBreastMins / 60), m = totalBreastMins % 60; parts.push(`${h > 0 ? `${h}h ${m}m` : `${m}m`} nursing`) }
    totalLine = parts.join(" · ")
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setSheet(null)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pointer-events-none">
        <div className="bg-background rounded-2xl shadow-2xl w-full max-w-sm max-h-[60vh] flex flex-col pointer-events-auto">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
            <h2 className="font-semibold">Today&apos;s {typeLabel}{babyName ? ` · ${babyName}` : ""}</h2>
            <button onClick={() => setSheet(null)} className="text-muted-foreground text-sm px-2 py-1">Done</button>
          </div>
          {totalLine && <div className="px-4 py-3 border-b bg-muted/40"><p className="text-sm font-semibold text-center">{totalLine}</p></div>}
          <div className="overflow-y-auto flex-1 px-4 py-2">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nothing logged today.</p>
            ) : (
              <div className="divide-y">
                {rows.map((r: Record<string, string>) => (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{rowLabel(r)}</p>
                      {rowDetail(r) && <p className="text-xs text-muted-foreground">{rowDetail(r)}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{rowTime(r)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
