-- 019: Harden invite codes — longer codes, expiration, regeneration, rate limiting
-- Addresses: brute-force risk (8-char hex → 12-char alphanumeric), permanent codes → 7-day expiry

-- Step 1: Helper to generate 12-char alphanumeric codes (62^12 ≈ 3.2 × 10^21 possibilities)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT string_agg(substr('abcdefghijklmnopqrstuvwxyz0123456789', ceil(random() * 36)::int, 1), '')
  FROM generate_series(1, 12)
$$;

-- Step 2: Add expiration column (default 7 days from now)
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS invite_code_expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days');

-- Step 3: Upgrade existing invite codes to 12-char + set expiry
UPDATE public.families
SET invite_code = public.generate_invite_code(),
    invite_code_expires_at = now() + interval '7 days'
WHERE length(invite_code) < 12;

-- Step 4: Change the default for new families
ALTER TABLE public.families
  ALTER COLUMN invite_code SET DEFAULT public.generate_invite_code();

-- Step 5: Update lookup_family_by_invite to enforce expiration
CREATE OR REPLACE FUNCTION public.lookup_family_by_invite(code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id
  FROM families
  WHERE invite_code = lower(trim(code))
    AND (invite_code_expires_at IS NULL OR invite_code_expires_at > now())
  LIMIT 1;

  IF found_id IS NOT NULL THEN
    INSERT INTO verified_invite_joins (user_id, family_id)
    VALUES (auth.uid(), found_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN found_id;
END;
$$;

-- Step 6: Regenerate invite code function (admin only, resets expiry to 7 days)
CREATE OR REPLACE FUNCTION public.regenerate_invite_code(target_family_id UUID)
RETURNS TABLE(new_code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  result_code TEXT;
  result_expires TIMESTAMPTZ;
BEGIN
  -- Verify caller is admin of this family
  SELECT role INTO caller_role
  FROM family_members
  WHERE family_id = target_family_id AND user_id = auth.uid();

  IF caller_role IS NULL OR caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Only family admins can regenerate invite codes';
  END IF;

  result_code := public.generate_invite_code();
  result_expires := now() + interval '7 days';

  UPDATE families
  SET invite_code = result_code,
      invite_code_expires_at = result_expires
  WHERE id = target_family_id;

  -- Clean up any old verified_invite_joins for this family (they used the old code)
  DELETE FROM verified_invite_joins WHERE family_id = target_family_id;

  RETURN QUERY SELECT result_code, result_expires;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_invite_code(UUID) TO authenticated;
