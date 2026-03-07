import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "./client"

/**
 * Returns a Supabase client with the user's access token explicitly set
 * in the Authorization header. Use this for all database mutations until
 * the server-side session issue is resolved.
 */
export async function getAuthedClient() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${session.access_token}` } } }
  )
}
