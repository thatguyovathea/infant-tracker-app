"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthedClient } from "@/lib/supabase/authed-client"
import type { Baby } from "@/app/dashboard/types"

type AuthFamily = {
  /** Supabase client with auth headers */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any
  session: { user: { id: string } }
  familyId: string
  babies: Baby[]
  displayName: string
  loading: boolean
}

/**
 * Shared hook that handles the auth check + family membership + baby list
 * boilerplate that every authenticated page needs.
 *
 * Redirects to /login if no session, /onboarding if no family membership.
 * Returns loading=true until ready.
 */
export function useAuthFamily(opts?: { skipBabies?: boolean; skipProfile?: boolean }) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [client, setClient] = useState<any>(null)
  const [session, setSession] = useState<{ user: { id: string } } | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [babies, setBabies] = useState<Baby[]>([])
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!s) { router.replace("/login"); return }
      const c = await getAuthedClient()
      if (!c) { router.replace("/login"); return }

      const { data: m } = await c
        .from("family_members").select("family_id")
        .eq("user_id", s.user.id).limit(1).maybeSingle()
      if (!m) { router.replace("/onboarding"); return }

      setClient(c)
      setSession(s)
      setFamilyId(m.family_id)

      // Parallel fetch babies + profile
      const [babiesRes, profileRes] = await Promise.all([
        opts?.skipBabies
          ? null
          : c.from("babies").select("id, name").eq("family_id", m.family_id).order("created_at"),
        opts?.skipProfile
          ? null
          : c.from("profiles").select("display_name").eq("id", s.user.id).limit(1).maybeSingle(),
      ])

      if (babiesRes) setBabies((babiesRes.data as Baby[] | null) ?? [])
      if (profileRes) setDisplayName((profileRes.data as { display_name: string } | null)?.display_name ?? "Someone")

      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [router, opts?.skipBabies, opts?.skipProfile])

  return { client, session, familyId, babies, displayName, loading } as AuthFamily & { loading: true } | AuthFamily
}
