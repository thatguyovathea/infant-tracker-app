import { PushNotifications } from "@capacitor/push-notifications"
import { Capacitor } from "@capacitor/core"
import { getAuthedClient } from "./supabase/authed-client"
import { createClient } from "./supabase/client"

export async function registerPushNotifications() {
  // Only run on native iOS
  if (!Capacitor.isNativePlatform()) return

  // Request permission
  const { receive } = await PushNotifications.requestPermissions()
  if (receive !== "granted") return

  // Register with APNs
  await PushNotifications.register()

  // Listen for the token
  PushNotifications.addListener("registration", async (token) => {
    await saveDeviceToken(token.value)
  })

  // Log errors silently
  PushNotifications.addListener("registrationError", (err) => {
    console.error("Push registration error:", err)
  })
}

async function saveDeviceToken(token: string) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const client = await getAuthedClient()
  if (!client) return

  await client.from("device_tokens").upsert(
    { user_id: session.user.id, token, platform: "ios" },
    { onConflict: "user_id,token" }
  )
}
