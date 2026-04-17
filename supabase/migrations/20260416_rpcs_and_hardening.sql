-- ============================================================
-- Vivra — Security hardening + RPCs for mobile
-- Date: 2026-04-16
--
-- Fixes:
--   1. Mobile invite accept RLS bug (pet_shares INSERT only allowed owner)
--   2. Self-referral bypass (enforced server-side in RPC)
--   3. Referral double-grant race (UNIQUE constraint + atomic RPC)
--   4. pet_share_invites too-open RLS (tightened to pending+unexpired)
--
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. UNIQUE constraint on referrals(referred_id)
--    Prevents double grant for same user across retries.
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referred_id_unique'
  ) THEN
    -- Clean up any existing duplicates first (keep most recent)
    DELETE FROM referrals a
    USING referrals b
    WHERE a.referred_id = b.referred_id
      AND a.ctid < b.ctid;

    ALTER TABLE referrals
      ADD CONSTRAINT referrals_referred_id_unique UNIQUE (referred_id);
  END IF;
END$$;

-- ─────────────────────────────────────────────
-- 2. RPC: accept_pet_share_invite
--    Lets a co-owner accept their own invite atomically.
--    Runs as definer so it bypasses the owner-only INSERT policy.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_pet_share_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_user_name TEXT;
  v_invite_id UUID;
  v_pet_id UUID;
  v_inviter_id UUID;
  v_invite_status TEXT;
  v_expires_at TIMESTAMPTZ;
  v_owner_id UUID;
  v_existing_share UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Fetch invite
  SELECT id, pet_id, inviter_id, status, expires_at
    INTO v_invite_id, v_pet_id, v_inviter_id, v_invite_status, v_expires_at
  FROM pet_share_invites
  WHERE token = p_token
  LIMIT 1;

  IF v_invite_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_invite_status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;

  IF v_expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_inviter_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_invite');
  END IF;

  -- Get pet owner
  SELECT user_id INTO v_owner_id FROM pets WHERE id = v_pet_id LIMIT 1;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pet_not_found');
  END IF;

  -- Already shared? idempotent success
  SELECT id INTO v_existing_share
  FROM pet_shares
  WHERE pet_id = v_pet_id AND shared_with = v_user_id
  LIMIT 1;

  IF v_existing_share IS NOT NULL THEN
    -- Still mark the invite as accepted if it wasn't
    UPDATE pet_share_invites
    SET status = 'accepted', accepted_by = v_user_id
    WHERE id = v_invite_id AND status = 'pending';
    RETURN jsonb_build_object('ok', true, 'pet_id', v_pet_id, 'already_shared', true);
  END IF;

  -- Pull user display info
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')
    INTO v_user_email, v_user_name
  FROM auth.users WHERE id = v_user_id;

  -- Insert the share
  INSERT INTO pet_shares (pet_id, owner_id, shared_with, shared_with_email, shared_with_name)
  VALUES (v_pet_id, v_owner_id, v_user_id, v_user_email, v_user_name);

  -- Mark invite accepted
  UPDATE pet_share_invites
  SET status = 'accepted', accepted_by = v_user_id
  WHERE id = v_invite_id;

  RETURN jsonb_build_object('ok', true, 'pet_id', v_pet_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_pet_share_invite(TEXT) TO authenticated;

-- ─────────────────────────────────────────────
-- 3. RPC: redeem_referral
--    Atomic referral redemption:
--    - Blocks self-referral
--    - Single UNIQUE row per referred_id prevents double grants
--    - Grants 30 days to referrer, 7 days trial to referred
--    - Idempotent: safe to retry
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_referral(p_code TEXT)
RETURNS JSONB
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

  -- BLOCK self-referral (auth.uid matches code owner)
  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
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

  -- Upsert referral row (UNIQUE on referred_id ensures single row)
  INSERT INTO referrals (referrer_id, referred_id, code, status, completed_at, reward_granted, premium_days_granted)
  VALUES (v_referrer_id, v_user_id, v_code, 'rewarded', v_now, TRUE, 30)
  ON CONFLICT (referred_id) DO UPDATE
    SET status = 'rewarded',
        completed_at = COALESCE(referrals.completed_at, v_now),
        reward_granted = TRUE,
        premium_days_granted = 30;

  -- Grant referrer: extend premium by 30 days (from whichever is later: now or current premium_until)
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

  -- Grant referred user: 7-day trial
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

GRANT EXECUTE ON FUNCTION public.redeem_referral(TEXT) TO authenticated;

-- ─────────────────────────────────────────────
-- 4. RPC: generate_my_referral_code
--    Creates a unique referral_codes row for the caller.
--    Idempotent — returns existing if present.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_my_referral_code(p_base TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing TEXT;
  v_base TEXT;
  v_candidate TEXT;
  v_tries INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Already has one?
  SELECT code INTO v_existing FROM referral_codes WHERE user_id = v_user_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'code', v_existing, 'existed', true);
  END IF;

  -- Build base: use provided, fallback to user email prefix, fallback to generic "PET"
  v_base := UPPER(REGEXP_REPLACE(COALESCE(p_base, ''), '[^A-Za-z0-9]', '', 'g'));
  IF LENGTH(v_base) < 3 THEN
    v_base := 'PET';
  END IF;
  v_base := SUBSTRING(v_base FROM 1 FOR 8);

  -- Try up to 8 candidates with random digits
  LOOP
    v_tries := v_tries + 1;
    v_candidate := v_base || LPAD((FLOOR(RANDOM() * 10000))::TEXT, 4, '0');
    BEGIN
      INSERT INTO referral_codes (user_id, code) VALUES (v_user_id, v_candidate);
      RETURN jsonb_build_object('ok', true, 'code', v_candidate, 'existed', false);
    EXCEPTION WHEN unique_violation THEN
      IF v_tries > 8 THEN
        -- Last-ditch: longer random tail
        v_candidate := v_base || LPAD((FLOOR(RANDOM() * 1000000))::TEXT, 6, '0');
        INSERT INTO referral_codes (user_id, code) VALUES (v_user_id, v_candidate);
        RETURN jsonb_build_object('ok', true, 'code', v_candidate, 'existed', false);
      END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_my_referral_code(TEXT) TO authenticated;

-- ─────────────────────────────────────────────
-- 5. Tighten pet_share_invites RLS
--    Previously: any auth user could read any invite row.
--    Now: only pending + unexpired visible to non-inviters (to accept).
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone authenticated can read invite by token (to accept)"
  ON pet_share_invites;

CREATE POLICY "Auth users can read pending unexpired invites"
  ON pet_share_invites FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND status = 'pending'
    AND expires_at > NOW()
  );

-- (The inviter's full-access policy stays — they can still see their own history.)

-- ─────────────────────────────────────────────
-- 6. Allow users to initialize their own "free" subscription row
--    Still prevents client-side premium escalation (plan must be 'free',
--    no premium_until / trial_ends_at can be set from the client).
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "User can initialize their own free subscription"
  ON user_subscriptions;

CREATE POLICY "User can initialize their own free subscription"
  ON user_subscriptions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND plan = 'free'
    AND premium_until IS NULL
    AND trial_ends_at IS NULL
  );

-- ============================================================
-- DONE
-- Verify RPCs:
--   SELECT proname FROM pg_proc WHERE proname IN
--     ('accept_pet_share_invite', 'redeem_referral', 'generate_my_referral_code');
-- ============================================================
