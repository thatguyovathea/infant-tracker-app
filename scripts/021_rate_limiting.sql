-- 021: Rate limiting for sensitive operations
-- Prevents brute-force invite code guessing and login abuse

-- Step 1: Rate limit table — tracks recent attempts per user per action
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits (user_id, action, attempted_at DESC);

-- RLS: no user access — only SECURITY DEFINER functions read/write
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Step 2: Helper to check + record an attempt. Returns TRUE if allowed, FALSE if rate-limited.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_attempts INT,
  p_window_minutes INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INT;
BEGIN
  -- Count attempts in the window
  SELECT count(*) INTO recent_count
  FROM rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND attempted_at > now() - (p_window_minutes || ' minutes')::interval;

  -- Record this attempt
  INSERT INTO rate_limits (user_id, action) VALUES (p_user_id, p_action);

  -- Purge old entries (older than 1 hour) to keep the table small
  DELETE FROM rate_limits
  WHERE action = p_action
    AND attempted_at < now() - interval '1 hour';

  RETURN recent_count < p_max_attempts;
END;
$$;

-- Step 3: Update lookup_family_by_invite to enforce rate limit (5 attempts per 15 minutes)
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
    INSERT INTO verified_invite_joins (user_id, family_id)
    VALUES (caller, found_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN found_id;
END;
$$;
