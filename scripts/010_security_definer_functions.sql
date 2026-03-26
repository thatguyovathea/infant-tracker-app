-- Create SECURITY DEFINER helper functions for RLS policies.
-- These avoid infinite recursion when family_members is queried inside RLS policies.

-- Used by: growth_logs RLS policy, and available for future policies.
CREATE OR REPLACE FUNCTION public.is_family_member(check_family_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = check_family_id AND user_id = auth.uid()
  )
$$;

-- Returns the calling user's family_id (useful for policies and app queries).
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM family_members WHERE user_id = auth.uid() LIMIT 1
$$;

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION public.is_family_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_family_id() TO authenticated;
