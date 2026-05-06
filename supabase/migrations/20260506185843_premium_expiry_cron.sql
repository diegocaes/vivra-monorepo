-- ============================================================================
-- Premium expiry cron — daily job to auto-demote expired non-IAP premium rows.
--
-- Context:
--   user_subscriptions.plan='premium' is set when:
--     - source='referral'  → +30d for referrer / +7d for referred
--     - source='trial'     → 7d trial
--     - source='promo'     → manual / promo grants
--     - source='iap'       → managed externally by RevenueCat (skip these)
--   Until now there was no auto-expiry: when premium_until passes, the row
--   stayed marked 'premium' indefinitely. Runtime checks would say "free",
--   but DB-side lookups (admin queries, analytics) saw stale state.
--
-- This cron runs nightly at 04:00 UTC and demotes rows where:
--   plan='premium' AND source IN ('referral','trial','promo')
--   AND premium_until IS NOT NULL AND premium_until < NOW()
--
-- IAP rows are intentionally untouched — RevenueCat owns that lifecycle.
--
-- pg_cron extension is already enabled in this project.
-- ============================================================================

-- Drop any prior version of the job (idempotent re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-premium-trials');
EXCEPTION WHEN OTHERS THEN
  -- Job didn't exist yet, no-op
  NULL;
END $$;

-- Schedule the job: every day at 04:00 UTC
SELECT cron.schedule(
  'expire-premium-trials',
  '0 4 * * *',
  $$
    UPDATE user_subscriptions
    SET plan = 'free',
        source = NULL,
        updated_at = NOW()
    WHERE plan = 'premium'
      AND source IN ('referral', 'trial', 'promo')
      AND premium_until IS NOT NULL
      AND premium_until < NOW();
  $$
);

-- Also run once immediately so the DB is consistent right after deploy.
UPDATE user_subscriptions
SET plan = 'free',
    source = NULL,
    updated_at = NOW()
WHERE plan = 'premium'
  AND source IN ('referral', 'trial', 'promo')
  AND premium_until IS NOT NULL
  AND premium_until < NOW();
