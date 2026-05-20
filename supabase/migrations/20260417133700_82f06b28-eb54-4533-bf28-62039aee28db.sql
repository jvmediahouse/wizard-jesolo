
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-jesolo-data-daily') THEN
    PERFORM cron.unschedule('sync-jesolo-data-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-jesolo-data-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gdxyjdggxtrhvieqtoct.supabase.co/functions/v1/sync-jesolo-data',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkeHlqZGdneHRyaHZpZXF0b2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODMxMzksImV4cCI6MjA5NDY1OTEzOX0.FjuGv-jNcXxEUkdXqnP7NBP_IVl9gHWJP_Ots3vqYRc"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);
