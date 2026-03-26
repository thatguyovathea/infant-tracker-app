-- 1. Add WITH CHECK to family_members UPDATE (prevent changing family_id/user_id)
DROP POLICY IF EXISTS "family_members_update_admin" ON public.family_members;

CREATE POLICY "family_members_update_admin" ON public.family_members FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to prevent changing immutable columns on family_members
CREATE OR REPLACE FUNCTION public.family_members_protect_columns()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.family_id <> OLD.family_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change family_id or user_id on family_members';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_members_protect_columns_trigger ON public.family_members;
CREATE TRIGGER family_members_protect_columns_trigger
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.family_members_protect_columns();

-- 2. Add device_tokens UPDATE policy for upsert support
DROP POLICY IF EXISTS "device_tokens_update_own" ON public.device_tokens;
CREATE POLICY "device_tokens_update_own" ON public.device_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Protect created_at on notifications
CREATE OR REPLACE FUNCTION public.notifications_protect_columns()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.title <> OLD.title
    OR NEW.body <> OLD.body
    OR NEW.actor_id <> OLD.actor_id
    OR NEW.type <> OLD.type
    OR NEW.family_id <> OLD.family_id
    OR NEW.reference_id IS DISTINCT FROM OLD.reference_id
    OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'Only read_by can be updated on notifications';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Add growth_logs UPDATE WITH CHECK
DROP POLICY IF EXISTS "growth_logs_update" ON public.growth_logs;
CREATE POLICY "growth_logs_update" ON public.growth_logs FOR UPDATE
  USING (is_family_member(family_id))
  WITH CHECK (is_family_member(family_id));

-- 5. Clean up verified_invite_joins after successful family_members insert
CREATE OR REPLACE FUNCTION public.cleanup_verified_invite_join()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM verified_invite_joins
  WHERE user_id = NEW.user_id AND family_id = NEW.family_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_verified_invite_join_trigger ON public.family_members;
CREATE TRIGGER cleanup_verified_invite_join_trigger
  AFTER INSERT ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_verified_invite_join();
