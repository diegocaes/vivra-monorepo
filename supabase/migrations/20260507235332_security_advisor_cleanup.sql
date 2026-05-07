-- ============================================================================
-- Security Advisor cleanup — fixes 2 categories of warnings:
--
-- 1. "Function Search Path Mutable" → ALTER FUNCTION ... SET search_path = public
-- 2. "Public Can Execute SECURITY DEFINER" → REVOKE EXECUTE FROM PUBLIC,
--    GRANT EXECUTE TO authenticated.
--
-- Idempotent + fault-tolerant: each ALTER/REVOKE/GRANT is wrapped in a DO
-- block that swallows "function/table does not exist" errors. Safe to run
-- in any order, even if some functions haven't been created yet.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Helper: run a statement and ignore "does not exist" errors. Lets us pin
-- search_path on functions even if some are still missing in this DB.
-- ────────────────────────────────────────────────────────────────────────────

DO $outer$
DECLARE
  fn_signatures TEXT[] := ARRAY[
    'public.is_pet_owner(uuid)',
    'public.user_can_access_pet(uuid)',
    'public.user_can_access_pet(uuid, uuid)',
    'public.is_flight_owner(uuid)',
    'public.accept_pet_share_invite(text)',
    'public.generate_my_referral_code(text)',
    'public.generate_referral_code(text)',
    'public.redeem_referral(text)',
    'public.set_iap_premium(timestamptz, text)',
    'public.clear_iap_premium()',
    'public.expire_my_premium_if_due()'
  ];
  sig TEXT;
BEGIN
  FOREACH sig IN ARRAY fn_signatures LOOP
    -- 1. Pin search_path
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', sig);
      RAISE NOTICE 'Pinned search_path on %', sig;
    EXCEPTION
      WHEN undefined_function THEN
        RAISE NOTICE 'Skipping % (does not exist)', sig;
      WHEN OTHERS THEN
        RAISE NOTICE 'Error on % (search_path): %', sig, SQLERRM;
    END;

    -- 2. REVOKE from PUBLIC, GRANT to authenticated
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
      RAISE NOTICE 'Restricted EXECUTE on %', sig;
    EXCEPTION
      WHEN undefined_function THEN
        NULL; -- already logged above
      WHEN OTHERS THEN
        RAISE NOTICE 'Error on % (grants): %', sig, SQLERRM;
    END;
  END LOOP;
END
$outer$;

-- ────────────────────────────────────────────────────────────────────────────
-- Drop the unused ios_waitlist table
--
-- Was created for the TestFlight beta waitlist. The app is now publicly
-- available on the App Store, so the waitlist no longer serves a purpose.
-- ────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.ios_waitlist;
