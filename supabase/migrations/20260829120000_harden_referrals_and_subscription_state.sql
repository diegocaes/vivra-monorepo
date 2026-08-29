-- Referral + subscription correctness hardening.
--
-- This migration intentionally does not change any current plan, source, or
-- expiration. Existing Apple/Paddle customers keep their exact access dates.
-- It removes client-side privilege escalation, makes redemption atomic, and
-- preserves earned referral days while a paid subscription is active.

BEGIN;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS referral_days_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS web_event_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS web_event_id text;

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_referral_days_balance_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_referral_days_balance_check
  CHECK (referral_days_balance >= 0);

-- Remove the accumulated legacy policies. Authenticated clients may only read
-- their own state; all billing and reward writes go through trusted webhooks or
-- the SECURITY DEFINER referral RPC below.
DROP POLICY IF EXISTS "User can initialize their own free subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "User can read their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users read own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users update own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "users_select_own_subscription" ON public.user_subscriptions;

DROP POLICY IF EXISTS "Anyone can check code exists" ON public.referral_codes;
DROP POLICY IF EXISTS "User can create their own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "User can read their own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "Users read own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "Users update own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "authenticated_validate_referral_code" ON public.referral_codes;
DROP POLICY IF EXISTS "users_select_own_referral_code" ON public.referral_codes;

DROP POLICY IF EXISTS "Referred user can read their referral" ON public.referrals;
DROP POLICY IF EXISTS "Referrer can read their referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users read own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users see referrals they made" ON public.referrals;
DROP POLICY IF EXISTS "users_select_own_referrals" ON public.referrals;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own_subscription
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY users_select_own_referral_code
  ON public.referral_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY users_select_own_referrals
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.referral_codes FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.referrals FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.user_subscriptions, public.referral_codes, public.referrals FROM anon;
GRANT SELECT ON public.user_subscriptions, public.referral_codes, public.referrals TO authenticated;

-- Pre-signup validation returns one boolean and does not expose code owners.
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.referral_codes
    WHERE code = UPPER(TRIM(p_code))
  );
$$;

-- A co-owner only needs the effective date, not their partner's billing row.
CREATE OR REPLACE FUNCTION public.get_shared_premium_until()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT MAX(us.premium_until)
  FROM public.pet_shares ps
  JOIN public.user_subscriptions us
    ON us.user_id = CASE
      WHEN ps.owner_id = auth.uid() THEN ps.shared_with
      ELSE ps.owner_id
    END
  WHERE auth.uid() IS NOT NULL
    AND (ps.owner_id = auth.uid() OR ps.shared_with = auth.uid())
    AND us.plan = 'premium'
    AND us.premium_until > NOW();
$$;

CREATE OR REPLACE FUNCTION public.generate_my_referral_code(p_base text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing text;
  v_base text;
  v_candidate text;
  v_tries integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT code INTO v_existing
  FROM public.referral_codes
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'code', v_existing, 'existed', true);
  END IF;

  v_base := UPPER(REGEXP_REPLACE(COALESCE(p_base, ''), '[^A-Za-z0-9]', '', 'g'));
  IF LENGTH(v_base) < 3 THEN v_base := 'PET'; END IF;
  v_base := SUBSTRING(v_base FROM 1 FOR 8);

  LOOP
    v_tries := v_tries + 1;
    v_candidate := v_base || LPAD((FLOOR(RANDOM() * 10000))::text, 4, '0');
    BEGIN
      INSERT INTO public.referral_codes (user_id, code)
      VALUES (v_user_id, v_candidate);
      RETURN jsonb_build_object('ok', true, 'code', v_candidate, 'existed', false);
    EXCEPTION WHEN unique_violation THEN
      IF v_tries >= 8 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'code_generation_failed');
      END IF;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_normalized text := UPPER(TRIM(p_code));
  v_referrer_id uuid;
  v_code text;
  v_existing_ref public.referrals%ROWTYPE;
  v_claimed_id uuid;
  v_now timestamptz := NOW();
  v_trial_end timestamptz := NOW() + INTERVAL '7 days';
  v_referrer_source text;
  v_referrer_current timestamptz;
  v_referrer_balance integer := 0;
  v_referrer_new timestamptz;
  v_referred_plan text;
  v_referred_until timestamptz;
  v_owned_count integer;
  v_trial_days integer := 0;
  v_bonus_queued boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF v_normalized IS NULL OR v_normalized = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_code');
  END IF;

  -- Locking the referrer's code serializes redemptions so uses_count and the
  -- accumulated reward cannot race under simultaneous signups.
  SELECT user_id, code INTO v_referrer_id, v_code
  FROM public.referral_codes
  WHERE code = v_normalized
  FOR UPDATE;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  -- The public promise is "rewarded when the friend creates a pet". Enforce
  -- that invariant in the database, not only in the UI.
  SELECT COUNT(*) INTO v_owned_count
  FROM public.pets
  WHERE user_id = v_user_id;
  IF v_owned_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'owned_pet_required');
  END IF;

  SELECT * INTO v_existing_ref
  FROM public.referrals
  WHERE referred_id = v_user_id
  LIMIT 1;

  IF v_existing_ref.id IS NOT NULL AND v_existing_ref.reward_granted IS TRUE THEN
    RETURN jsonb_build_object('ok', true, 'already_redeemed', true);
  END IF;
  IF v_existing_ref.id IS NOT NULL AND v_existing_ref.referrer_id <> v_referrer_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'referral_already_attributed');
  END IF;

  -- The conditional conflict update is the idempotency gate. Only the one
  -- transaction that claims this referred_id continues to grant rewards.
  INSERT INTO public.referrals AS existing (
    referrer_id, referred_id, code, status, completed_at,
    reward_granted, premium_days_granted
  ) VALUES (
    v_referrer_id, v_user_id, v_code, 'rewarded', v_now, TRUE, 30
  )
  ON CONFLICT (referred_id) DO UPDATE
    SET status = 'rewarded',
        completed_at = COALESCE(existing.completed_at, v_now),
        reward_granted = TRUE,
        premium_days_granted = 30
    WHERE existing.reward_granted IS NOT TRUE
      AND existing.referrer_id = EXCLUDED.referrer_id
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_redeemed', true);
  END IF;

  SELECT source, premium_until, referral_days_balance
    INTO v_referrer_source, v_referrer_current, v_referrer_balance
  FROM public.user_subscriptions
  WHERE user_id = v_referrer_id
  FOR UPDATE;

  IF FOUND
    AND v_referrer_source IN ('iap', 'web')
    AND v_referrer_current > v_now
  THEN
    -- Paid plans continue to be managed by Apple/Paddle. Queue earned days so
    -- a later renewal cannot overwrite or consume them.
    UPDATE public.user_subscriptions
    SET referral_days_balance = COALESCE(referral_days_balance, 0) + 30,
        updated_at = v_now
    WHERE user_id = v_referrer_id;
    v_referrer_new := v_referrer_current;
    v_bonus_queued := true;
  ELSE
    v_referrer_new := GREATEST(COALESCE(v_referrer_current, v_now), v_now) + INTERVAL '30 days';
    INSERT INTO public.user_subscriptions (
      user_id, plan, source, premium_until, updated_at
    ) VALUES (
      v_referrer_id, 'premium', 'referral', v_referrer_new, v_now
    )
    ON CONFLICT (user_id) DO UPDATE
      SET plan = 'premium',
          source = 'referral',
          premium_until = v_referrer_new,
          updated_at = v_now;
  END IF;

  UPDATE public.referral_codes
  SET uses_count = COALESCE(uses_count, 0) + 1
  WHERE user_id = v_referrer_id;

  SELECT plan, premium_until INTO v_referred_plan, v_referred_until
  FROM public.user_subscriptions
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_referred_plan <> 'premium' OR v_referred_until IS NULL OR v_referred_until <= v_now THEN
    INSERT INTO public.user_subscriptions (
      user_id, plan, source, trial_ends_at, premium_until, updated_at
    ) VALUES (
      v_user_id, 'premium', 'trial', v_trial_end, v_trial_end, v_now
    )
    ON CONFLICT (user_id) DO UPDATE
      SET plan = 'premium',
          source = 'trial',
          trial_ends_at = v_trial_end,
          premium_until = v_trial_end,
          updated_at = v_now;
    v_trial_days := 7;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'referrer_days_granted', 30,
    'referrer_bonus_queued', v_bonus_queued,
    'referrer_premium_until', v_referrer_new,
    'referred_trial_days', v_trial_days,
    'trial_ends_at', CASE WHEN v_trial_days > 0 THEN v_trial_end ELSE NULL END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'internal');
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_my_premium_if_due()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_subscriptions
  SET plan = 'free',
      source = NULL,
      premium_until = NULL,
      trial_ends_at = NULL,
      updated_at = NOW()
  WHERE user_id = auth.uid()
    AND plan = 'premium'
    AND source IN ('referral', 'trial', 'promo')
    AND premium_until IS NOT NULL
    AND premium_until < NOW();
$$;

-- Client-chosen IAP expiry is forbidden; only the signed RevenueCat webhook
-- may write IAP state with the service role.
REVOKE EXECUTE ON FUNCTION public.set_iap_premium(timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_iap_premium() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_referral_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_shared_premium_until() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_my_referral_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_referral(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_my_premium_if_due() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_premium_until() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_my_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_my_premium_if_due() TO authenticated;

COMMIT;
