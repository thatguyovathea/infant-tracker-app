import { createClient } from "jsr:@supabase/supabase-js@2"

// Triggered by a Supabase Database Webhook on notifications INSERT
// The webhook sends { type, table, record, schema, old_record }

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  const body = await req.json()
  // Webhook payload wraps the row in `record`
  const record = body.record ?? body
  if (!record?.id || !record?.family_id) return new Response("Bad payload", { status: 400 })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Get all family members except the actor who created this notification
  const { data: members } = await supabase
    .from("family_members")
    .select("user_id")
    .eq("family_id", record.family_id)
    .neq("user_id", record.actor_id)

  if (!members?.length) return new Response("No recipients", { status: 200 })

  const userIds = members.map((m: { user_id: string }) => m.user_id)

  // Get their APNs device tokens
  const { data: tokens } = await supabase
    .from("device_tokens")
    .select("token")
    .in("user_id", userIds)
    .eq("platform", "ios")

  if (!tokens?.length) return new Response("No device tokens", { status: 200 })

  const jwt = await buildApnsJwt(
    Deno.env.get("APNS_PRIVATE_KEY")!,
    Deno.env.get("APNS_KEY_ID")!,
    Deno.env.get("APNS_TEAM_ID")!
  )

  const bundleId = Deno.env.get("APNS_BUNDLE_ID")!
  const sandbox = Deno.env.get("APNS_SANDBOX") === "true"
  const apnsBase = sandbox
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com"

  const apnsBody = JSON.stringify({
    aps: {
      alert: { title: record.title, body: record.body },
      sound: "default",
      badge: 1,
    },
  })

  const results = await Promise.allSettled(
    tokens.map(({ token }: { token: string }) =>
      fetch(`${apnsBase}/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": bundleId,
          "apns-push-type": "alert",
          "content-type": "application/json",
        },
        body: apnsBody,
      }).then(async res => {
        if (!res.ok) {
          const err = await res.text()
          console.error(`APNs error for token ${token.slice(0, 8)}…: ${err}`)
        }
      })
    )
  )

  const failed = results.filter(r => r.status === "rejected").length
  console.log(`Sent ${tokens.length - failed}/${tokens.length} push notifications`)

  return new Response("OK", { status: 200 })
})

async function buildApnsJwt(p8Key: string, keyId: string, teamId: string): Promise<string> {
  const pemBody = p8Key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "")

  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  )

  const b64url = (s: string) =>
    btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }))
  const claims = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }))
  const message = `${header}.${claims}`

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(message)
  )

  const sigB64 = b64url(String.fromCharCode(...new Uint8Array(sig)))
  return `${message}.${sigB64}`
}
