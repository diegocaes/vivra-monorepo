-- Run only after the signed RevenueCat webhook is verified in Production.
BEGIN;

-- Subscription state belongs to verified server-side payment/referral flows.
-- The client never needs direct UPDATE or DELETE access to this table.
DROP POLICY IF EXISTS "Users update own subscription" ON public.user_subscriptions;
REVOKE UPDATE, DELETE ON TABLE public.user_subscriptions FROM anon, authenticated;

-- These SECURITY DEFINER functions previously let a client choose its own
-- Premium expiration. RevenueCat's signed webhook now performs IAP updates.
REVOKE EXECUTE ON FUNCTION public.set_iap_premium(timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_iap_premium()
  FROM PUBLIC, anon, authenticated;

COMMIT;
