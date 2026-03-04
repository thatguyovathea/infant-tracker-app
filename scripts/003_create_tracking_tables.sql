-- Feeding logs
CREATE TABLE IF NOT EXISTS public.feeding_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  logged_by UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('breast', 'bottle', 'solid')),
  side TEXT CHECK (side IN ('left', 'right', 'both')),
  amount_ml NUMERIC,
  duration_minutes INTEGER,
  food_name TEXT,
  food_brand TEXT,
  food_barcode TEXT,
  food_image_url TEXT,
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sleep logs
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  logged_by UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  quality TEXT CHECK (quality IN ('good', 'fair', 'poor')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Diaper logs
CREATE TABLE IF NOT EXISTS public.diaper_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  logged_by UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('wet', 'dirty', 'both', 'dry')),
  notes TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feeding_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diaper_logs ENABLE ROW LEVEL SECURITY;

-- Feeding: family members CRUD
CREATE POLICY "feeding_select" ON public.feeding_logs FOR SELECT
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
CREATE POLICY "feeding_insert" ON public.feeding_logs FOR INSERT
  WITH CHECK (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
CREATE POLICY "feeding_update" ON public.feeding_logs FOR UPDATE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
CREATE POLICY "feeding_delete" ON public.feeding_logs FOR DELETE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Sleep: family members CRUD
CREATE POLICY "sleep_select" ON public.sleep_logs FOR SELECT
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
CREATE POLICY "sleep_insert" ON public.sleep_logs FOR INSERT
  WITH CHECK (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
CREATE POLICY "sleep_update" ON public.sleep_logs FOR UPDATE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
CREATE POLICY "sleep_delete" ON public.sleep_logs FOR DELETE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Diaper: family members CRUD
CREATE POLICY "diaper_select" ON public.diaper_logs FOR SELECT
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
CREATE POLICY "diaper_insert" ON public.diaper_logs FOR INSERT
  WITH CHECK (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
CREATE POLICY "diaper_update" ON public.diaper_logs FOR UPDATE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
CREATE POLICY "diaper_delete" ON public.diaper_logs FOR DELETE
  USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));
