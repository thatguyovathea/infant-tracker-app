import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

export function createClient() {
  if (client) return client
  client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
