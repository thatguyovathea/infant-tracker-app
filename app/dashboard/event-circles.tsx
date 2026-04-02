"use client"

import type { RefObject } from "react"
import type { Baby, ActiveSleep } from "./types"

interface EventCirclesProps {
  babies: Baby[]
  activeSleep: ActiveSleep | null
  sleepElapsed: string
  logging: "feeding" | "sleep" | "diaper" | null
  flashSuccess: "feeding" | "sleep" | "diaper" | null
  picking: "feeding" | "sleep" | "diaper" | null
  handleTap: (type: "feeding" | "sleep" | "diaper") => void
  doLog: (type: "feeding" | "sleep" | "diaper", babyId: string) => void
  setPicking: (v: "feeding" | "sleep" | "diaper" | null) => void
  eventCirclesRef: RefObject<HTMLDivElement | null>
}

export function EventCircles({
  babies, activeSleep, sleepElapsed, logging, flashSuccess,
  picking, handleTap, doLog, setPicking, eventCirclesRef,
}: EventCirclesProps) {
  return (
    <div className="relative z-10 shrink-0 border-t bg-background">
      <div className="px-4 pt-3 pb-3 max-w-lg mx-auto w-full">
        <div ref={eventCirclesRef} className="flex justify-evenly items-start">
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => handleTap("feeding")} disabled={logging === "feeding"}
              className={`w-[30vw] h-[30vw] rounded-full border-0 flex items-center justify-center active:scale-95 transition-all duration-150 ${flashSuccess === "feeding" ? "bg-sky-400/40" : "bg-sky-400/20"}`}>
              <span className="text-6xl">{flashSuccess === "feeding" ? "\u2705" : "\ud83c\udf7c"}</span>
            </button>
            <p className="text-sm font-bold text-sky-900 dark:text-sky-100">Eat</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => handleTap("sleep")} disabled={logging === "sleep"}
              className={`w-[30vw] h-[30vw] rounded-full border-0 flex items-center justify-center active:scale-95 transition-all duration-150 ${flashSuccess === "sleep" ? "bg-violet-400/40" : activeSleep ? "bg-violet-400/30" : "bg-violet-400/20"}`}>
              <span className="text-6xl">{flashSuccess === "sleep" ? "\u2705" : "\ud83d\ude34"}</span>
            </button>
            <p className="text-sm font-bold text-violet-900 dark:text-violet-100">
              {activeSleep ? sleepElapsed : "Sleep"}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => handleTap("diaper")} disabled={logging === "diaper"}
              className={`w-[30vw] h-[30vw] rounded-full border-0 flex items-center justify-center active:scale-95 transition-all duration-150 ${flashSuccess === "diaper" ? "bg-emerald-400/40" : "bg-emerald-400/20"}`}>
              {flashSuccess === "diaper" ? <span className="text-6xl">{"\u2705"}</span> : <img src="/diaper.webp" alt="diaper" className="w-12 h-12 object-contain" />}
            </button>
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Change</p>
          </div>
        </div>

        {picking && (
          <div className="mt-3 flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-muted-foreground w-full text-center font-medium">Which baby?</p>
            {babies.map(b => (
              <button key={b.id} onClick={() => { setPicking(null); doLog(picking, b.id) }}
                className="px-4 py-1.5 rounded-full bg-muted text-sm font-medium border">{b.name}</button>
            ))}
            <button onClick={() => setPicking(null)} className="px-4 py-1.5 rounded-full bg-muted border text-sm text-muted-foreground">Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}
