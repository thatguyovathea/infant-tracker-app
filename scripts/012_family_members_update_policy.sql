-- Task #10: Add family_members UPDATE policy (only admins can change roles)
DROP POLICY IF EXISTS "family_members_update_admin" ON public.family_members;

CREATE POLICY "family_members_update_admin" ON public.family_members FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
