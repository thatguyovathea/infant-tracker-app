-- Task #13: Restrict notifications UPDATE to only allow modifying the read_by column
-- This prevents users from changing notification title, body, actor_id, etc.
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;

-- Use a column-level check: only allow updates where non-read_by columns remain unchanged
-- Supabase approach: use WITH CHECK to verify only read_by changed
CREATE POLICY "notifications_update_read_by" ON public.notifications FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- All non-read_by columns must stay the same (enforced via USING + same family check)
    family_id IN (
      SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );

-- Additionally, use a trigger to prevent changing columns other than read_by
CREATE OR REPLACE FUNCTION public.notifications_protect_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.title <> OLD.title
    OR NEW.body <> OLD.body
    OR NEW.actor_id <> OLD.actor_id
    OR NEW.type <> OLD.type
    OR NEW.family_id <> OLD.family_id
    OR NEW.reference_id IS DISTINCT FROM OLD.reference_id
  THEN
    RAISE EXCEPTION 'Only read_by can be updated on notifications';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_protect_columns_trigger ON public.notifications;
CREATE TRIGGER notifications_protect_columns_trigger
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notifications_protect_columns();
