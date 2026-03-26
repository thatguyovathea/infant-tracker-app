-- Fix: Remove overly permissive families_select_invite policy
-- that lets any authenticated user enumerate ALL families.
-- Replace with a SECURITY DEFINER function for invite code lookup.

-- 1. Drop the dangerous policy
DROP POLICY IF EXISTS "families_select_invite" ON public.families;

-- 2. Create a secure lookup function (returns only the family ID for an exact invite code)
CREATE OR REPLACE FUNCTION public.lookup_family_by_invite(code TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM families WHERE invite_code = lower(trim(code)) LIMIT 1
$$;

-- 3. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.lookup_family_by_invite(TEXT) TO authenticated;
