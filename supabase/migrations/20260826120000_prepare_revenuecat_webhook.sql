-- Prepare the subscription table for verified RevenueCat webhook events.
-- This migration is additive: it does not alter existing subscription rows.
BEGIN;

-- Keep an ordering marker for RevenueCat webhooks and the product identifier
-- that originated the latest Apple/Google entitlement update.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS iap_event_timestamp BIGINT;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS iap_product_id TEXT;

COMMIT;
