CREATE TABLE IF NOT EXISTS public.baby_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.baby_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baby_notes_select" ON public.baby_notes FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "baby_notes_insert" ON public.baby_notes FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "baby_notes_delete" ON public.baby_notes FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    )
  );
