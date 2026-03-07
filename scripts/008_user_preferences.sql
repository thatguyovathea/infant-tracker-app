CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quick_prefs JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences_select" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_update" ON public.user_preferences;

CREATE POLICY "user_preferences_select" ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert" ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update" ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);
