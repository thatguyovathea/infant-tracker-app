import { PushNotifications } from "@capacitor/push-notifications"
import { Capacitor } from "@capacitor/core"
import { getAuthedClient } from "./supabase/authed-client"
import { createClient } from "./supabase/client"

export async function registerPushNotifications() {
  // Only run on native iOS
  if (!Capacitor.isNativePlatform()) {
    console.log("[Push] Not native platform, skipping")
    return
  }

  try {
    // Check current permission status first
    const { receive: current } = await PushNotifications.checkPermissions()
    console.log("[Push] Current permission status:", current)

    // Request permission if not already granted
    const { receive } = await PushNotifications.requestPermissions()
    console.log("[Push] Permission after request:", receive)

    if (receive !== "granted") {
      console.log("[Push] Permission not granted, skipping registration")
      return
    }

    // Remove stale listeners from previous calls before re-registering
    await PushNotifications.removeAllListeners()

    // Attach listeners BEFORE calling register() to avoid race condition
    PushNotifications.addListener("registration", async (token) => {
      console.log("[Push] Got device token:", token.value.slice(0, 16) + "…")
      await saveDeviceToken(token.value)
    })

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[Push] Registration error:", JSON.stringify(err))
    })

    // Register with APNs
    await PushNotifications.register()
    console.log("[Push] Registered with APNs")
  } catch (err) {
    console.error("[Push] Unexpected error:", err)
  }
}

let savingToken = false
async function saveDeviceToken(token: string) {
  if (savingToken) return
  savingToken = true
  // Retry a few times — session may not be ready immediately after native registration event
  for (let attempt = 1; attempt <= 3; attempt++) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log(`[Push] No session on attempt ${attempt}, retrying in 2s…`)
      await new Promise(r => setTimeout(r, 2000))
      continue
    }

    const { error } = await supabase
      .from("device_tokens")
      .upsert(
        { user_id: session.user.id, token, platform: "ios" },
        { onConflict: "user_id,token" }
      )

    if (error) {
      console.error("[Push] Failed to save token:", error.message)
    } else {
      console.log("[Push] Device token saved for user:", session.user.id.slice(0, 8) + "…")
    }
    savingToken = false
    return
  }
  savingToken = false
  console.error("[Push] Could not save token — no session after 3 attempts")
}
