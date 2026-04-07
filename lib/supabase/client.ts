import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

export function createClient() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    // Return a stub during prerender / missing env so the build doesn't crash.
    // Real calls in the browser will throw clearly when env is actually missing.
    if (typeof window === "undefined") {
      return new Proxy({}, {
        get() {
          throw new Error("Supabase client unavailable during prerender")
        },
      }) as unknown as SupabaseClient
    }
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set")
  }
  client = createSupabaseClient(
    url,
    anonKey,
    {
      auth: {
        persistSession: true,
        storageKey: "infant-tracker-auth",
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    }
  )
  return client
}
