-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('feeding', 'sleep', 'diaper', 'family_join')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  reference_id UUID,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "push_select_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_delete_own" ON public.push_subscriptions;

-- Notifications: family members can read
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Notifications: family members can insert
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
  WITH CHECK (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Notifications: family members can update (mark as read)
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Push subscriptions: users manage their own
CREATE POLICY "push_select_own" ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "push_insert_own" ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_delete_own" ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
