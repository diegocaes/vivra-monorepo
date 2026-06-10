-- ============================================================================
-- Daily push dispatcher cron — invokes the send-push edge function.
--
-- Closes the retention gap: local notifications only re-schedule when the
-- user opens the app. This cron makes the server push what's due (preventivo
-- vencido, vacuna vencida, peso sin registrar, re-engagement) every day at
-- 15:00 UTC ≈ 10:00 Panamá — mid-morning local, good open rates.
--
-- Uses pg_net (async http) — already enabled in this project (it appeared in
-- the Security Advisor extension list). pg_cron is enabled too.
--
-- ⚠️ BEFORE RUNNING, replace the two placeholders below:
--   1. YOUR_CRON_SECRET — generate one:  openssl rand -hex 32
--      and set the SAME value as an edge function secret:
--        npx supabase secrets set CRON_SECRET=<value>
--   2. Verify the project-ref in the URL matches your project
--      (upjiewrirkzhjeciwugg per apps/mobile/lib/supabase.ts).
-- ============================================================================

-- Drop any prior version of the job (idempotent re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('send-push-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'send-push-daily',
  '0 15 * * *',  -- 15:00 UTC = ~10:00 Panamá
  $$
    SELECT net.http_post(
      url := 'https://upjiewrirkzhjeciwugg.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', 'YOUR_CRON_SECRET'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
