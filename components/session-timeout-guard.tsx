"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { startSessionTimeout, stopSessionTimeout } from "@/lib/session-timeout"

/** Pages that don't require auth — skip timeout on these */
const PUBLIC_PATHS = ["/login", "/signup", "/reset-password", "/update-password", "/privacy"]

export function SessionTimeoutGuard() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
      stopSessionTimeout()
      return
    }

    startSessionTimeout(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      try {
        localStorage.removeItem("dash-cache-v3")
        localStorage.removeItem("infant-tracker-offline-queue")
        localStorage.removeItem("infant-tracker-quick-prefs")
        localStorage.removeItem("barcode-cache")
        Object.keys(localStorage)
          .filter(k => k.startsWith("baby-avatar-"))
          .forEach(k => localStorage.removeItem(k))
      } catch { /* localStorage unavailable */ }
      router.replace("/login")
    })

    return () => stopSessionTimeout()
  }, [pathname, router])

  return null
}
