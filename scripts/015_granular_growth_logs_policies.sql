-- Task #14: Replace growth_logs FOR ALL with granular policies
DROP POLICY IF EXISTS "Family members can manage growth logs" ON public.growth_logs;

-- SELECT: family members can view
CREATE POLICY "growth_logs_select" ON public.growth_logs FOR SELECT
  USING (is_family_member(family_id));

-- INSERT: family members can add, must set their own logged_by
CREATE POLICY "growth_logs_insert" ON public.growth_logs FOR INSERT
  WITH CHECK (
    is_family_member(family_id)
    AND (logged_by IS NULL OR logged_by = auth.uid())
  );

-- UPDATE: family members can update logs in their family
CREATE POLICY "growth_logs_update" ON public.growth_logs FOR UPDATE
  USING (is_family_member(family_id));

-- DELETE: only admins can delete growth logs
CREATE POLICY "growth_logs_delete" ON public.growth_logs FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
