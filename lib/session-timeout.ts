/**
 * Session timeout — auto-logout after 30 minutes of inactivity.
 * Tracks user interaction events (touch, click, keydown, scroll)
 * and signs out when the idle threshold is exceeded.
 */

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const ACTIVITY_EVENTS = ["touchstart", "mousedown", "keydown", "scroll"] as const

let timer: ReturnType<typeof setTimeout> | null = null
let onTimeoutCallback: (() => void) | null = null

function resetTimer() {
  if (timer) clearTimeout(timer)
  if (!onTimeoutCallback) return
  timer = setTimeout(() => {
    onTimeoutCallback?.()
  }, IDLE_TIMEOUT_MS)
}

export function startSessionTimeout(onTimeout: () => void) {
  if (typeof window === "undefined") return

  onTimeoutCallback = onTimeout
  resetTimer()

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, resetTimer, { passive: true })
  }
}

export function stopSessionTimeout() {
  if (typeof window === "undefined") return

  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  onTimeoutCallback = null

  for (const event of ACTIVITY_EVENTS) {
    window.removeEventListener(event, resetTimer)
  }
}
