-- 023: Atomic admin transfer — prevents race condition where two admins could exist
-- Replaces the client-side two-UPDATE pattern with a single transactional function

CREATE OR REPLACE FUNCTION public.transfer_admin(
  target_family_id UUID,
  new_admin_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID;
  caller_role TEXT;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is current admin
  SELECT role INTO caller_role
  FROM family_members
  WHERE family_id = target_family_id AND user_id = caller;

  IF caller_role IS NULL OR caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Only the current admin can transfer admin role';
  END IF;

  -- Verify target is a member of this family
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = target_family_id AND user_id = new_admin_id
  ) THEN
    RAISE EXCEPTION 'Target user is not a member of this family';
  END IF;

  -- Atomic swap: promote target and demote caller in one transaction
  UPDATE family_members SET role = 'admin'
  WHERE family_id = target_family_id AND user_id = new_admin_id;

  UPDATE family_members SET role = 'member'
  WHERE family_id = target_family_id AND user_id = caller;

  -- Audit log
  INSERT INTO audit_log (actor_id, family_id, action, target_type, target_id, detail)
  VALUES (caller, target_family_id, 'admin.transfer', 'family_member', new_admin_id::text,
          jsonb_build_object('from', caller::text, 'to', new_admin_id::text));
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_admin(UUID, UUID) TO authenticated;
