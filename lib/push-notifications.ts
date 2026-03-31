import { PushNotifications } from "@capacitor/push-notifications"
import { Capacitor } from "@capacitor/core"
import { createClient } from "./supabase/client"

export async function registerPushNotifications() {
  if (!Capacitor.isNativePlatform()) return

  try {
    const { receive } = await PushNotifications.requestPermissions()
    if (receive !== "granted") return

    await PushNotifications.removeAllListeners()

    PushNotifications.addListener("registration", async (token) => {
      await saveDeviceToken(token.value)
    })

    PushNotifications.addListener("registrationError", () => {})

    await PushNotifications.register()
  } catch {
    // Push registration failed — non-critical, app works without it
  }
}

let savingToken = false
async function saveDeviceToken(token: string) {
  if (savingToken) return
  savingToken = true
  for (let attempt = 1; attempt <= 3; attempt++) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      await new Promise(r => setTimeout(r, 2000))
      continue
    }

    await supabase
      .from("device_tokens")
      .upsert(
        { user_id: session.user.id, token, platform: "ios" },
        { onConflict: "user_id,token" }
      )

    savingToken = false
    return
  }
  savingToken = false
}
