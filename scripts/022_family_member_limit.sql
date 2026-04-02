-- 022: Limit family members to 10 per family
-- Prevents invite code abuse (unlimited account joins)

-- Update lookup_family_by_invite to check member count before allowing join
CREATE OR REPLACE FUNCTION public.lookup_family_by_invite(code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id UUID;
  caller UUID;
  allowed BOOLEAN;
  member_count INT;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN
    RETURN NULL;
  END IF;

  -- Rate limit: 5 attempts per 15 minutes
  allowed := public.check_rate_limit(caller, 'invite_lookup', 5, 15);
  IF NOT allowed THEN
    RAISE EXCEPTION 'Too many attempts. Please wait before trying again.';
  END IF;

  SELECT id INTO found_id
  FROM families
  WHERE invite_code = lower(trim(code))
    AND (invite_code_expires_at IS NULL OR invite_code_expires_at > now())
  LIMIT 1;

  IF found_id IS NOT NULL THEN
    -- Check member limit (max 10)
    SELECT count(*) INTO member_count FROM family_members WHERE family_id = found_id;
    IF member_count >= 10 THEN
      RAISE EXCEPTION 'This family has reached the maximum number of members.';
    END IF;

    INSERT INTO verified_invite_joins (user_id, family_id)
    VALUES (caller, found_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN found_id;
END;
$$;
