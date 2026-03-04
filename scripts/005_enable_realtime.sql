-- Enable Supabase Realtime for activity tables and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feeding_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sleep_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.diaper_logs;
