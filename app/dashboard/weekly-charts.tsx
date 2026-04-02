"use client"

import { useRouter } from "next/navigation"
import { BarChart, Bar, XAxis, Cell, ResponsiveContainer } from "recharts"
import type { RefObject } from "react"
import type { WeekDay } from "./types"

interface WeeklyChartsProps {
  weekFeedings: WeekDay[]
  weekSleep: WeekDay[]
  drawerOpen: boolean
  chartsRef: RefObject<HTMLDivElement | null>
}

export function WeeklyCharts({ weekFeedings, weekSleep, drawerOpen, chartsRef }: WeeklyChartsProps) {
  const router = useRouter()

  return (
    <div ref={chartsRef} className={`flex flex-col overflow-hidden transition-all duration-300 ${drawerOpen ? "max-h-0 opacity-0" : "flex-1 min-h-0 opacity-100"}`}>
      <div className="flex-1 flex flex-col min-h-0 px-4 pt-3 pb-2 gap-3">
        <button onClick={() => router.push("/trends")} className="flex-1 min-h-0 rounded-xl border bg-card p-3 flex flex-col text-left active:opacity-70 transition-opacity">
          <p className="text-xs font-semibold text-muted-foreground mb-1 shrink-0">Feedings · 7 days</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekFeedings} barCategoryGap="15%">
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {weekFeedings.map((d, i) => (
                    <Cell key={d.day + i} fill={i === 6 ? "rgb(56 189 248)" : "rgb(56 189 248 / 0.4)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </button>
        <button onClick={() => router.push("/trends")} className="flex-1 min-h-0 rounded-xl border bg-card p-3 flex flex-col text-left active:opacity-70 transition-opacity">
          <p className="text-xs font-semibold text-muted-foreground mb-1 shrink-0">Sleep · 7 days</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekSleep} barCategoryGap="15%">
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {weekSleep.map((d, i) => (
                    <Cell key={d.day + i} fill={i === 6 ? "rgb(139 92 246)" : "rgb(139 92 246 / 0.4)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </button>
      </div>
    </div>
  )
}
