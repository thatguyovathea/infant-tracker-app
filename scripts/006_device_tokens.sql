-- Device tokens for iOS push notifications
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_tokens_select_own" ON public.device_tokens;
DROP POLICY IF EXISTS "device_tokens_insert_own" ON public.device_tokens;
DROP POLICY IF EXISTS "device_tokens_delete_own" ON public.device_tokens;

CREATE POLICY "device_tokens_select_own" ON public.device_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "device_tokens_insert_own" ON public.device_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "device_tokens_delete_own" ON public.device_tokens FOR DELETE USING (auth.uid() = user_id);
