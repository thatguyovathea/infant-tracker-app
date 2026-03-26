-- CRITICAL FIX: Remove the INSERT policy on verified_invite_joins.
-- The policy allowed any authenticated user to insert a record for ANY family_id,
-- bypassing invite code validation entirely.
-- Only the SECURITY DEFINER function lookup_family_by_invite() should insert rows.
DROP POLICY IF EXISTS "verified_joins_insert_own" ON public.verified_invite_joins;

-- Also add a time-based expiry check to the family_members INSERT policy
-- so verified_invite_joins records older than 1 hour cannot be used.
DROP POLICY IF EXISTS "family_members_insert" ON public.family_members;

CREATE POLICY "family_members_insert" ON public.family_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- (a) User created this family (founder)
      family_id IN (SELECT id FROM public.families WHERE created_by = auth.uid())
      OR
      -- (b) User has a verified invite join record created within the last hour
      EXISTS (
        SELECT 1 FROM public.verified_invite_joins
        WHERE verified_invite_joins.user_id = auth.uid()
          AND verified_invite_joins.family_id = family_members.family_id
          AND verified_invite_joins.created_at > now() - interval '1 hour'
      )
    )
  );
