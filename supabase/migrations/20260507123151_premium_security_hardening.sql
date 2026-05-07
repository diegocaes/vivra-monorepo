-- ============================================================================
-- Premium / Referral / Co-owner SECURITY HARDENING
--
-- Fixes critical gaps identified in production audit:
--
-- 1. user_subscriptions, referrals, referral_codes had NO RLS — any
--    authenticated user could UPDATE their own row to plan='premium' or
--    tamper with referral state. Privilege escalation risk.
-- 2. redeem_referral did not validate that the referred user has at least
--    one owned pet — pure co-owners (already inherit premium from owner)
--    could call the RPC directly via API and stack +7d trial on top.
-- 3. redeem_referral had no rate limit — a single referrer could mass-create
--    accounts and self-farm 30d-per-referral indefinitely.
--
-- All policies / functions are idempotent (CREATE OR REPLACE / safe drops).
-- Apply via Supabase Studio → SQL Editor → paste + Run.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. RLS for user_subscriptions
-- ────────────────────────────────────────────────────────────────────────────
-- Strategy:
--   * Users can SELECT their own row (needed by useSubscription / getPremiumStatus)
--   * Users CANNOT INSERT/UPDATE/DELETE — only the service_role (admin client) can.
--   * The on-load expiry "demote" flow (R7b) was using the user-authenticated
--     client — we move that responsibility to a SECURITY DEFINER RPC.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_subscription" ON user_subscriptions;
CREATE POLICY "users_select_own_subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for authenticated → blocked by default.
-- service_role bypasses RLS entirely (used by admin client + RPCs).

-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS for referral_codes
-- ────────────────────────────────────────────────────────────────────────────
-- Strategy:
--   * SELECT: a user can read their own code, AND anyone can read by `code`
--     for validation during signup (we need to check if a code is valid
--     before storing it in the cookie). For privacy we still require auth.
--   * No writes from authenticated — only RPCs (which are SECURITY DEFINER).
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_referral_code" ON referral_codes;
CREATE POLICY "users_select_own_referral_code"
  ON referral_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Anyone authenticated can validate a code by `code` (for signup flow).
-- This is intentional: we want signup to verify "is this code real?" without
-- the would-be referee needing to be the owner of the code.
DROP POLICY IF EXISTS "authenticated_validate_referral_code" ON referral_codes;
CREATE POLICY "authenticated_validate_referral_code"
  ON referral_codes FOR SELECT
  TO authenticated
  USING (true);
-- Note: this exposes the existence of arbitrary codes by enumeration. That's
-- acceptable — referral codes are short marketing tokens, not secrets. The
-- only thing the user can do with them is sign up referenced. A more strict
-- alternative (validate via RPC) is reserved for future hardening if needed.

-- No INSERT/UPDATE/DELETE for authenticated.

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RLS for referrals
-- ────────────────────────────────────────────────────────────────────────────
-- Strategy:
--   * SELECT: own rows where you're either the referrer or referred.
--   * No writes from authenticated — only the redeem_referral RPC.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_referrals" ON referrals;
CREATE POLICY "users_select_own_referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Tighten redeem_referral RPC
--
-- Adds two new safeguards:
--   a) Block "pure co-owners" (0 owned pets, ≥1 shared pet) — they already
--      inherit premium from the owner and shouldn't double-dip via referral.
--   b) Daily rate limit per referrer — max 5 successful referrals per
--      24h window. Prevents abuse from a single account.
--
-- Everything else (self-referral block, idempotent, +30d/+7d, etc) preserved
-- exactly as the audited working version.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_normalized TEXT := UPPER(TRIM(p_code));
  v_referrer_id UUID;
  v_code TEXT;
  v_existing_ref RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_trial_end TIMESTAMPTZ;
  v_referrer_current TIMESTAMPTZ;
  v_referrer_new TIMESTAMPTZ;
  v_owned_count INT;
  v_shared_count INT;
  v_recent_referrals_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF v_normalized IS NULL OR v_normalized = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_code');
  END IF;

  -- Look up the referrer
  SELECT user_id, code INTO v_referrer_id, v_code
  FROM referral_codes
  WHERE code = v_normalized
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  -- BLOCK self-referral
  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  -- ── NEW: Block pure co-owners ──
  -- A user with zero owned pets but at least one shared pet is a
  -- "pure co-owner" — already inheriting premium from the owner. Allowing
  -- them to redeem would let one household double-dip.
  SELECT COUNT(*) INTO v_owned_count FROM pets WHERE user_id = v_user_id;
  SELECT COUNT(*) INTO v_shared_count FROM pet_shares WHERE shared_with = v_user_id;

  IF v_owned_count = 0 AND v_shared_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pure_co_owner_blocked');
  END IF;

  -- ── NEW: Rate limit referrer to 5 redemptions per 24h ──
  SELECT COUNT(*) INTO v_recent_referrals_count
  FROM referrals
  WHERE referrer_id = v_referrer_id
    AND reward_granted = TRUE
    AND completed_at > v_now - INTERVAL '24 hours';

  IF v_recent_referrals_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'referrer_rate_limited');
  END IF;

  -- Already have a referral row? Idempotent return.
  SELECT * INTO v_existing_ref
  FROM referrals
  WHERE referred_id = v_user_id
  LIMIT 1;

  IF v_existing_ref.id IS NOT NULL AND v_existing_ref.reward_granted THEN
    RETURN jsonb_build_object('ok', true, 'already_redeemed', true);
  END IF;

  -- Compute dates
  v_trial_end := v_now + INTERVAL '7 days';

  SELECT premium_until INTO v_referrer_current
  FROM user_subscriptions
  WHERE user_id = v_referrer_id
  LIMIT 1;

  v_referrer_new := GREATEST(COALESCE(v_referrer_current, v_now), v_now) + INTERVAL '30 days';

  -- Upsert referral row
  INSERT INTO referrals (referrer_id, referred_id, code, status, completed_at, reward_granted, premium_days_granted)
  VALUES (v_referrer_id, v_user_id, v_code, 'rewarded', v_now, TRUE, 30)
  ON CONFLICT (referred_id) DO UPDATE
    SET status = 'rewarded',
        completed_at = COALESCE(referrals.completed_at, v_now),
        reward_granted = TRUE,
        premium_days_granted = 30;

  -- Grant referrer: extend premium by 30 days
  INSERT INTO user_subscriptions (user_id, plan, source, premium_until, updated_at)
  VALUES (v_referrer_id, 'premium', 'referral', v_referrer_new, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET plan = 'premium',
        source = 'referral',
        premium_until = v_referrer_new,
        updated_at = v_now;

  -- Increment uses_count on referrer's code
  UPDATE referral_codes
  SET uses_count = COALESCE(uses_count, 0) + 1
  WHERE user_id = v_referrer_id;

  -- Grant referred user: 7-day trial — only if currently free
  INSERT INTO user_subscriptions (user_id, plan, source, trial_ends_at, premium_until, updated_at)
  VALUES (v_user_id, 'premium', 'trial', v_trial_end, v_trial_end, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET plan = CASE WHEN user_subscriptions.plan = 'free' THEN 'premium' ELSE user_subscriptions.plan END,
        source = CASE WHEN user_subscriptions.plan = 'free' THEN 'trial' ELSE user_subscriptions.source END,
        trial_ends_at = CASE WHEN user_subscriptions.plan = 'free' THEN v_trial_end ELSE user_subscriptions.trial_ends_at END,
        premium_until = CASE WHEN user_subscriptions.plan = 'free' THEN v_trial_end ELSE user_subscriptions.premium_until END,
        updated_at = v_now;

  RETURN jsonb_build_object(
    'ok', true,
    'referrer_days_granted', 30,
    'referred_trial_days', 7,
    'trial_ends_at', v_trial_end
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'internal', 'detail', SQLERRM);
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. New SECURITY DEFINER RPC: set_iap_premium
--
-- Lets the mobile client (after a successful RevenueCat purchase) record the
-- premium status in user_subscriptions WITHOUT giving authenticated users
-- direct UPDATE rights on the table.
--
-- Validates the calling user matches the row being touched (no spoofing).
-- The actual entitlement validation (was the IAP real?) still happens in
-- RevenueCat — this RPC just mirrors the state into Supabase so web + analytics
-- can see it. A future RC webhook will replace this for full robustness.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_iap_premium(
  p_premium_until timestamptz,
  p_iap_product_id text DEFAULT NULL  -- accepted but ignored (column doesn't exist in table)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_premium_until IS NULL OR p_premium_until < v_now THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_premium_until');
  END IF;

  INSERT INTO user_subscriptions (user_id, plan, source, premium_until, updated_at)
  VALUES (v_user_id, 'premium', 'iap', p_premium_until, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET plan = 'premium',
        source = 'iap',
        premium_until = p_premium_until,
        updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'premium_until', p_premium_until);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'internal', 'detail', SQLERRM);
END;
$$;

-- Grant execute to authenticated users (users that just bought IAP).
GRANT EXECUTE ON FUNCTION public.set_iap_premium(timestamptz, text) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. New SECURITY DEFINER RPC: clear_iap_premium
--
-- Counterpart to set_iap_premium: when RevenueCat reports the entitlement is
-- no longer active (cancelled / lapsed), the client mirrors that to Supabase
-- so analytics + web don't see stale premium state.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.clear_iap_premium()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Only clear rows where source='iap'. Don't touch referral/trial/promo
  -- rows — those have their own lifecycles (cron, redeem flow, etc.)
  UPDATE user_subscriptions
  SET plan = 'free',
      source = NULL,
      premium_until = NULL,
      updated_at = v_now
  WHERE user_id = v_user_id
    AND source = 'iap';

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'internal', 'detail', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_iap_premium() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. New SECURITY DEFINER RPC: expire_my_premium_if_due
--
-- Replaces the on-load UPDATE that the client was doing directly. Now that
-- user_subscriptions has RLS and authenticated users can't UPDATE, the client
-- calls this RPC instead. Idempotent with the nightly pg_cron job.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.expire_my_premium_if_due()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_rows_affected INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  UPDATE user_subscriptions
  SET plan = 'free',
      source = NULL,
      updated_at = v_now
  WHERE user_id = v_user_id
    AND plan = 'premium'
    AND source IN ('referral', 'trial', 'promo')
    AND premium_until IS NOT NULL
    AND premium_until < v_now;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'demoted', v_rows_affected > 0);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'internal', 'detail', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_my_premium_if_due() TO authenticated;
