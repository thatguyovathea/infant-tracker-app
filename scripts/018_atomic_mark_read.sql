-- Atomic mark-as-read using array_append to prevent race conditions
CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET read_by = array_append(read_by, auth.uid())
  WHERE id = notification_id
    AND family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    AND NOT (auth.uid() = ANY(read_by));
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
