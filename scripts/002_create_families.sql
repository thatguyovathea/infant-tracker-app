-- Families
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Family members (join table)
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, user_id)
);

-- Babies
CREATE TABLE IF NOT EXISTS public.babies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.babies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "families_select_member" ON public.families;
DROP POLICY IF EXISTS "families_select_invite" ON public.families;
DROP POLICY IF EXISTS "families_insert" ON public.families;
DROP POLICY IF EXISTS "families_update_admin" ON public.families;
DROP POLICY IF EXISTS "family_members_select" ON public.family_members;
DROP POLICY IF EXISTS "family_members_insert" ON public.family_members;
DROP POLICY IF EXISTS "family_members_delete_admin" ON public.family_members;
DROP POLICY IF EXISTS "family_members_delete_self" ON public.family_members;
DROP POLICY IF EXISTS "babies_select" ON public.babies;
DROP POLICY IF EXISTS "babies_insert" ON public.babies;
DROP POLICY IF EXISTS "babies_update" ON public.babies;
DROP POLICY IF EXISTS "babies_delete_admin" ON public.babies;

-- Families: members can read their own family
CREATE POLICY "families_select_member" ON public.families FOR SELECT
  USING (id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Invite code lookup handled by lookup_family_by_invite() SECURITY DEFINER function
-- (see 009_fix_family_rls.sql) — no open SELECT policy needed.

-- Families: anyone authenticated can create
CREATE POLICY "families_insert" ON public.families FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Families: only admin can update
CREATE POLICY "families_update_admin" ON public.families FOR UPDATE
  USING (id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'admin'));

-- Family members: members can see other members in their family
CREATE POLICY "family_members_select" ON public.family_members FOR SELECT
  USING (family_id IN (SELECT family_id FROM public.family_members fm WHERE fm.user_id = auth.uid()));

-- Family members: insert restricted to founders + verified invite joins
-- (see 013_restrict_family_members_insert.sql for the updated policy)
CREATE POLICY "family_members_insert" ON public.family_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Family members: admins can delete members
CREATE POLICY "family_members_delete_admin" ON public.family_members FOR DELETE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'admin'));

-- Family members: members can leave themselves
CREATE POLICY "family_members_delete_self" ON public.family_members FOR DELETE
  USING (auth.uid() = user_id);

-- Babies: family members can view
CREATE POLICY "babies_select" ON public.babies FOR SELECT
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Babies: family members can insert
CREATE POLICY "babies_insert" ON public.babies FOR INSERT
  WITH CHECK (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Babies: family members can update
CREATE POLICY "babies_update" ON public.babies FOR UPDATE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Babies: admins can delete
CREATE POLICY "babies_delete_admin" ON public.babies FOR DELETE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'admin'));
