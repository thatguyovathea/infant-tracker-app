-- 020: Audit logging for sensitive operations
-- Captures: member joins/leaves, role changes, baby deletes, invite code regeneration, auth events

-- Step 1: Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,                          -- auth.uid() of who did it (NULL for system/trigger context)
  family_id UUID,                         -- affected family (NULL if not family-scoped)
  action TEXT NOT NULL,                   -- e.g. 'member.join', 'member.leave', 'role.change', 'baby.delete'
  target_type TEXT,                       -- e.g. 'family_member', 'baby', 'family'
  target_id TEXT,                         -- PK of the affected row
  detail JSONB DEFAULT '{}'::jsonb        -- additional context
);

-- Index for querying by family
CREATE INDEX IF NOT EXISTS idx_audit_log_family ON public.audit_log (family_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log (action, ts DESC);

-- RLS: only admins of the family can read their family's audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin" ON public.audit_log FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies for users — only triggers and SECURITY DEFINER functions write to this table
GRANT SELECT ON public.audit_log TO authenticated;

-- Step 2: Trigger on family_members (join/leave/role change)
CREATE OR REPLACE FUNCTION public.audit_family_members_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (actor_id, family_id, action, target_type, target_id, detail)
    VALUES (NEW.user_id, NEW.family_id, 'member.join', 'family_member', NEW.id::text,
            jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log role changes
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO audit_log (actor_id, family_id, action, target_type, target_id, detail)
      VALUES (auth.uid(), NEW.family_id, 'role.change', 'family_member', NEW.user_id::text,
              jsonb_build_object('from', OLD.role, 'to', NEW.role));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (actor_id, family_id, action, target_type, target_id, detail)
    VALUES (auth.uid(), OLD.family_id, 'member.leave', 'family_member', OLD.user_id::text,
            jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_family_members ON public.family_members;
CREATE TRIGGER trg_audit_family_members
  AFTER INSERT OR UPDATE OR DELETE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_family_members_change();

-- Step 3: Trigger on babies (delete only — inserts/updates are routine)
CREATE OR REPLACE FUNCTION public.audit_baby_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (actor_id, family_id, action, target_type, target_id, detail)
  VALUES (auth.uid(), OLD.family_id, 'baby.delete', 'baby', OLD.id::text,
          jsonb_build_object('name', OLD.name));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_baby_delete ON public.babies;
CREATE TRIGGER trg_audit_baby_delete
  AFTER DELETE ON public.babies
  FOR EACH ROW EXECUTE FUNCTION public.audit_baby_delete();

-- Step 4: Update regenerate_invite_code to log the action
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

  -- Audit log
  INSERT INTO audit_log (actor_id, family_id, action, target_type, target_id, detail)
  VALUES (auth.uid(), target_family_id, 'invite.regenerate', 'family', target_family_id::text,
          jsonb_build_object('expires_at', result_expires));

  -- Clean up any old verified_invite_joins for this family
  DELETE FROM verified_invite_joins WHERE family_id = target_family_id;

  RETURN QUERY SELECT result_code, result_expires;
END;
$$;
