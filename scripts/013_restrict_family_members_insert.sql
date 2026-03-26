-- Task #11: Restrict family_members INSERT so users can't join arbitrary families
-- by guessing a family_id. The new policy requires that either:
--   (a) The user created the family (they're the founder), OR
--   (b) They are joining via the validated invite code path (verified_invite_joins table)
--
-- The onboarding flow must insert into verified_invite_joins before inserting into family_members.

-- Step 1: Create a verified invite joins table that acts as a short-lived proof
CREATE TABLE IF NOT EXISTS public.verified_invite_joins (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, family_id)
);

ALTER TABLE public.verified_invite_joins ENABLE ROW LEVEL SECURITY;

-- NO INSERT policy — only the SECURITY DEFINER lookup_family_by_invite() can insert.
-- (An INSERT policy here would let users bypass invite validation.)

-- Users can read their own
CREATE POLICY "verified_joins_select_own" ON public.verified_invite_joins FOR SELECT
  USING (auth.uid() = user_id);

-- Step 2: Replace the family_members INSERT policy
DROP POLICY IF EXISTS "family_members_insert" ON public.family_members;

CREATE POLICY "family_members_insert" ON public.family_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- (a) User created this family (founder joining their own family)
      family_id IN (SELECT id FROM public.families WHERE created_by = auth.uid())
      OR
      -- (b) User has a verified invite join record
      EXISTS (
        SELECT 1 FROM public.verified_invite_joins
        WHERE verified_invite_joins.user_id = auth.uid()
          AND verified_invite_joins.family_id = family_members.family_id
      )
    )
  );

-- Step 3: Update lookup_family_by_invite to also insert into verified_invite_joins
CREATE OR REPLACE FUNCTION public.lookup_family_by_invite(code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id FROM families WHERE invite_code = lower(trim(code)) LIMIT 1;
  IF found_id IS NOT NULL THEN
    INSERT INTO verified_invite_joins (user_id, family_id)
    VALUES (auth.uid(), found_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN found_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_family_by_invite(TEXT) TO authenticated;
