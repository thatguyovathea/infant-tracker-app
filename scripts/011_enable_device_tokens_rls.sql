-- Fix: Enable RLS on device_tokens (policies exist but RLS was not activated).
-- Flagged by Supabase security advisor 2026-03-25.
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
