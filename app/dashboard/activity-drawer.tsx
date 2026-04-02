"use client"

import { formatDistanceToNow } from "date-fns"
import type { MutableRefObject, RefObject } from "react"
import type { ActivityItem } from "./types"

interface ActivityDrawerProps {
  activity: ActivityItem[]
  babyMap: Record<string, string>
  multipleBabies: boolean
  drawerOpen: boolean
  setDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  drawerHandleRef: RefObject<HTMLDivElement | null>
  drawerOuterRef: RefObject<HTMLDivElement | null>
  drawerContentRef: RefObject<HTMLDivElement | null>
  dragStartY: MutableRefObject<number | null>
  didDrag: MutableRefObject<boolean>
  startDrawerHeight: MutableRefObject<number>
}

const dotColors: Record<string, string> = { feeding: "bg-sky-400", sleep: "bg-violet-400", diaper: "bg-emerald-400" }

export function ActivityDrawer({
  activity, babyMap, multipleBabies, drawerOpen, setDrawerOpen,
  drawerHandleRef, drawerOuterRef, drawerContentRef,
  dragStartY, didDrag, startDrawerHeight,
}: ActivityDrawerProps) {

  function onDragStart(clientY: number) {
    dragStartY.current = clientY
    didDrag.current = false
    startDrawerHeight.current = drawerContentRef.current?.getBoundingClientRect().height ?? 0
  }

  function onDragMove(clientY: number) {
    if (dragStartY.current === null) return
    const delta = dragStartY.current - clientY
    if (Math.abs(delta) > 5) didDrag.current = true
    const contentEl = drawerContentRef.current
    const outerEl = drawerOuterRef.current
    const maxH = window.innerHeight * 0.7
    const newH = Math.max(0, Math.min(startDrawerHeight.current + delta, maxH))
    if (contentEl) { contentEl.style.transition = 'none'; contentEl.style.maxHeight = `${newH}px` }
    const ty = Math.max(0, -delta)
    if (outerEl) { outerEl.style.transition = 'none'; outerEl.style.transform = ty > 0 ? `translateY(${ty}px)` : '' }
  }

  function onDragEnd() {
    dragStartY.current = null
    if (!didDrag.current) return
    const contentEl = drawerContentRef.current
    const outerEl = drawerOuterRef.current
    const currentH = contentEl ? parseFloat(contentEl.style.maxHeight) || 0 : 0
    const draggedDown = startDrawerHeight.current - currentH
    const shouldOpen = draggedDown < 100
    if (outerEl) { outerEl.style.transition = 'transform 300ms ease-out'; outerEl.style.transform = 'translateY(0)' }
    if (contentEl) { contentEl.style.transition = 'max-height 300ms ease-out'; contentEl.style.maxHeight = shouldOpen ? `${window.innerHeight * 0.7}px` : '0px' }
    setTimeout(() => {
      if (outerEl) { outerEl.style.transform = ''; outerEl.style.transition = '' }
      if (shouldOpen) {
        setDrawerOpen(true)
        if (contentEl) { contentEl.style.maxHeight = ''; contentEl.style.transition = '' }
      } else {
        setDrawerOpen(false)
        if (contentEl) { contentEl.style.transition = '' }
      }
    }, 320)
  }

  return (
    <div ref={drawerOuterRef} className="flex flex-col shrink-0">
      <div
        ref={drawerHandleRef}
        className="shrink-0 flex flex-col items-center border-t bg-background/80 touch-none py-2 gap-1.5"
        onClick={() => {
          if (didDrag.current) { didDrag.current = false; return }
          if (!drawerOpen && drawerContentRef.current) {
            drawerContentRef.current.style.maxHeight = ''
            drawerContentRef.current.style.transition = ''
          }
          setDrawerOpen((p: boolean) => !p)
        }}
        onTouchStart={e => onDragStart(e.touches[0].clientY)}
        onTouchMove={e => onDragMove(e.touches[0].clientY)}
        onTouchEnd={() => onDragEnd()}
        onMouseDown={e => onDragStart(e.clientY)}
        onMouseMove={e => { if (e.buttons === 0) return; onDragMove(e.clientY) }}
        onMouseUp={() => onDragEnd()}
        onMouseLeave={() => { dragStartY.current = null }}
      >
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center justify-center w-full px-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest leading-none m-0">Recent activity</p>
        </div>
      </div>
      <div ref={drawerContentRef} className={`overflow-y-auto overflow-hidden transition-[max-height] duration-300 ease-out ${drawerOpen ? "max-h-[70vh]" : "max-h-0"}`}>
        <div className="px-5 pb-2">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity yet.</p>
          ) : activity.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0">
              <div className={`w-2 h-2 rounded-full shrink-0 ${dotColors[item.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.label}</p>
                {multipleBabies && babyMap[item.babyId] && (
                  <p className="text-xs text-muted-foreground">{babyMap[item.babyId]}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
