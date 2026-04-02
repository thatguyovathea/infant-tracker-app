"use client"

import { useRouter } from "next/navigation"
import { Settings, Bell, ScanBarcode, FilePen } from "lucide-react"
import { useDashboardBg } from "@/lib/dashboard-bg"
import { BarcodeScannerModal } from "@/components/barcode-scanner-modal"
import { canScan } from "@/lib/barcode-scanner"
import { Walkthrough } from "@/components/walkthrough"
import { GroupIcon } from "./types"
import { useDashboardData } from "./use-dashboard-data"
import { WeeklyCharts } from "./weekly-charts"
import { ActivityDrawer } from "./activity-drawer"
import { EventCircles } from "./event-circles"
import { DailyDetailSheet } from "./daily-detail-sheet"

export default function DashboardPage() {
  const router = useRouter()
  const { bg } = useDashboardBg()
  const d = useDashboardData()
  const multipleBabies = d.babies.length > 1

  if (d.loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {d.scanning && <BarcodeScannerModal onResult={d.handleScanResult} onClose={() => d.setScanning(false)} />}

      {bg.image && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={bg.image} alt="" className="w-full h-full object-cover"
            style={{ opacity: bg.opacity, filter: `blur(${bg.blur}px)`, transform: "scale(1.05)" }} />
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 px-5 pt-5 pb-2 flex items-center justify-between max-w-lg mx-auto w-full">
        <h1 className="text-3xl font-bold leading-tight">
          {d.babies.length === 0 ? "Add a baby" : d.babies.map(b => b.name).join(" & ")}
        </h1>
        <div className="flex items-center gap-0.5">
          {d.pendingCount > 0 && (
            <span className="text-[10px] font-semibold text-green-600 bg-green-100 border border-green-300 px-1.5 py-0.5 rounded-full mr-1">
              {d.pendingCount}
            </span>
          )}
          <button ref={d.settingsIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted" onClick={() => router.push("/settings")}>
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Today stats */}
      {d.babies.length > 0 && (() => {
        const displaySummaries = d.summaries.length > 0
          ? d.summaries
          : d.babies.map(b => ({ babyId: b.id, feedings: 0, sleepMinutes: 0, diapers: 0 }))
        return (
          <div className="relative z-10 shrink-0 border-b bg-background/80 backdrop-blur-sm w-full">
            {displaySummaries.map(s => {
              const sleepH = Math.round(s.sleepMinutes / 60)
              const sleepStr = s.sleepMinutes === 0 ? "\u2014" : s.sleepMinutes < 30 ? "<1h" : `${sleepH}h`
              return (
                <div key={s.babyId} className="px-5 py-2 max-w-lg mx-auto w-full">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => d.setSheet({ type: "feeding", babyId: s.babyId })}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl active:opacity-60 transition-opacity bg-sky-400/25">
                      <span className="text-2xl">{"\ud83c\udf7c"}</span>
                      <span className="text-xl font-bold text-sky-200">{s.feedings}</span>
                    </button>
                    <button onClick={() => d.setSheet({ type: "sleep", babyId: s.babyId })}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl active:opacity-60 transition-opacity bg-violet-400/25">
                      <span className="text-2xl">{"\ud83d\ude34"}</span>
                      <span className="text-xl font-bold text-violet-200">{sleepStr}</span>
                    </button>
                    <button onClick={() => d.setSheet({ type: "diaper", babyId: s.babyId })}
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl active:opacity-60 transition-opacity bg-emerald-400/25">
                      <span className="text-2xl">{"\ud83e\uddf7"}</span>
                      <span className="text-xl font-bold text-emerald-200">{s.diapers}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Middle: charts (collapsed) or activity (open) */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden w-full">
        <div className="flex-1 flex flex-col overflow-hidden max-w-lg mx-auto w-full">
          <WeeklyCharts
            weekFeedings={d.weekFeedings}
            weekSleep={d.weekSleep}
            drawerOpen={d.drawerOpen}
            chartsRef={d.chartsRef}
          />
          <ActivityDrawer
            activity={d.activity}
            babyMap={d.babyMap}
            multipleBabies={multipleBabies}
            drawerOpen={d.drawerOpen}
            setDrawerOpen={d.setDrawerOpen}
            drawerHandleRef={d.drawerHandleRef}
            drawerOuterRef={d.drawerOuterRef}
            drawerContentRef={d.drawerContentRef}
            dragStartY={d.dragStartY}
            didDrag={d.didDrag}
            startDrawerHeight={d.startDrawerHeight}
          />
        </div>
      </div>

      <EventCircles
        babies={d.babies}
        activeSleep={d.activeSleep}
        sleepElapsed={d.sleepElapsed}
        logging={d.logging}
        flashSuccess={d.flashSuccess}
        picking={d.picking}
        handleTap={d.handleTap}
        doLog={d.doLog}
        setPicking={d.setPicking}
        eventCirclesRef={d.eventCirclesRef}
      />

      {/* Bottom ribbon */}
      <div className="relative z-10 shrink-0 border-t bg-background" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-evenly px-6 py-1 max-w-lg mx-auto w-full">
          <button ref={d.familyIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => router.push("/family")}>
            <GroupIcon className="w-5 h-5" />
          </button>
          <button ref={d.activityIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => router.push("/history")}>
            <FilePen className="w-5 h-5" />
          </button>
          {canScan() ? (
            <button ref={d.scanIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => d.setScanning(true)}>
              <ScanBarcode className="w-5 h-5" />
            </button>
          ) : <div className="h-9 w-9" />}
          <button ref={d.notificationsIconRef} className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => { d.setUnreadCount(0); router.push("/notifications") }}>
            <Bell className="w-5 h-5" />
            {d.unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {d.unreadCount > 9 ? "9+" : d.unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <Walkthrough refs={{
        eventCircles: d.eventCirclesRef,
        drawerHandle: d.drawerHandleRef,
        charts: d.chartsRef,
        familyIcon: d.familyIconRef,
        activityIcon: d.activityIconRef,
        scanIcon: d.scanIconRef,
        notificationsIcon: d.notificationsIconRef,
        settingsIcon: d.settingsIconRef,
      }} />

      {d.sheet && (
        <DailyDetailSheet
          sheet={d.sheet}
          setSheet={d.setSheet}
          todayLogs={d.todayLogs}
          babyMap={d.babyMap}
          multipleBabies={multipleBabies}
        />
      )}
    </div>
  )
}
