"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"

const SKIP_PATHS = ["/dashboard", "/login", "/signup", "/onboarding", "/onboarding/baby"]
const EDGE_ZONE = 20   // px from left edge to start gesture
const MIN_SWIPE_X = 60 // px horizontal travel to trigger
const RATIO = 1.5      // horizontal must exceed vertical by this factor

export function EdgeSwipeBack() {
  const router = useRouter()
  const pathname = usePathname()
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      if (t.clientX <= EDGE_ZONE) {
        startX.current = t.clientX
        startY.current = t.clientY
      } else {
        startX.current = null
        startY.current = null
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (startX.current === null || startY.current === null) return
      const t = e.changedTouches[0]
      const dx = t.clientX - startX.current
      const dy = Math.abs(t.clientY - startY.current)
      startX.current = null
      startY.current = null
      if (dx >= MIN_SWIPE_X && dx > dy * RATIO) {
        router.push("/dashboard")
      }
    }

    if (SKIP_PATHS.includes(pathname)) return

    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [pathname, router])

  return null
}
