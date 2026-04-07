import * as Sentry from "@sentry/browser"

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

let initialized = false

export function initSentry() {
  if (initialized || !DSN || typeof window === "undefined") return
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Strip PII: remove user IP
      if (event.user) delete event.user.ip_address
      return event
    },
  })
  initialized = true
}
