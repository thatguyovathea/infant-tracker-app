import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "./client"

let authedClient: SupabaseClient | null = null
let cachedToken: string | null = null

/**
 * Returns a Supabase client with the user's access token explicitly set
 * in the Authorization header. Use this for all database mutations until
 * the server-side session issue is resolved.
 *
 * Cached per access token — only recreated on token refresh.
 */
export async function getAuthedClient() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  if (authedClient && cachedToken === session.access_token) {
    return authedClient
  }

  cachedToken = session.access_token
  authedClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  )
  return authedClient
}
