-- ============================================================
-- Vivra — Enable RLS on ALL tables + create access policies
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Helper: check if a user owns or co-owns a pet
CREATE OR REPLACE FUNCTION public.user_can_access_pet(p_pet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pets WHERE id = p_pet_id AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM pet_shares WHERE pet_id = p_pet_id AND shared_with = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────
-- 1. PETS
-- ─────────────────────────────────────────────
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can do everything with their pets"
  ON pets FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Co-owner can read shared pets"
  ON pets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM pet_shares WHERE pet_id = pets.id AND shared_with = auth.uid())
  );

CREATE POLICY "Co-owner can update shared pets"
  ON pets FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM pet_shares WHERE pet_id = pets.id AND shared_with = auth.uid())
  );

-- ─────────────────────────────────────────────
-- 2. VACCINES
-- ─────────────────────────────────────────────
ALTER TABLE vaccines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage vaccines for accessible pets"
  ON vaccines FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 3. VET_VISITS
-- ─────────────────────────────────────────────
ALTER TABLE vet_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage vet visits for accessible pets"
  ON vet_visits FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 4. WEIGHT_RECORDS
-- ─────────────────────────────────────────────
ALTER TABLE weight_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage weight records for accessible pets"
  ON weight_records FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 5. GROOMINGS
-- ─────────────────────────────────────────────
ALTER TABLE groomings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage groomings for accessible pets"
  ON groomings FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 6. FOODS
-- ─────────────────────────────────────────────
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage foods for accessible pets"
  ON foods FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 7. FLIGHTS
-- ─────────────────────────────────────────────
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage flights for accessible pets"
  ON flights FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 8. FLIGHT_DOCUMENTS
-- ─────────────────────────────────────────────
ALTER TABLE flight_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage flight documents for accessible flights"
  ON flight_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM flights
      WHERE flights.id = flight_documents.flight_id
        AND public.user_can_access_pet(flights.pet_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM flights
      WHERE flights.id = flight_documents.flight_id
        AND public.user_can_access_pet(flights.pet_id)
    )
  );

-- ─────────────────────────────────────────────
-- 9. ADVENTURES
-- ─────────────────────────────────────────────
ALTER TABLE adventures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage adventures for accessible pets"
  ON adventures FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 10. TREATS
-- ─────────────────────────────────────────────
ALTER TABLE treats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage treats for accessible pets"
  ON treats FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 11. PREVENTIVE_TREATMENTS
-- ─────────────────────────────────────────────
ALTER TABLE preventive_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage preventive treatments for accessible pets"
  ON preventive_treatments FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 12. ACTIVITY_LOGS
-- ─────────────────────────────────────────────
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage activity logs for accessible pets"
  ON activity_logs FOR ALL
  USING (public.user_can_access_pet(pet_id))
  WITH CHECK (public.user_can_access_pet(pet_id));

-- ─────────────────────────────────────────────
-- 13. NOTIFICATIONS
-- ─────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage their own notifications"
  ON notifications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 14. PUSH_TOKENS
-- ─────────────────────────────────────────────
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can manage their own push tokens"
  ON push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 15. USER_SUBSCRIPTIONS
-- ─────────────────────────────────────────────
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can read their own subscription"
  ON user_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Inserts/updates done via admin client (onboarding, referral rewards)
-- No INSERT/UPDATE policy for regular users needed

-- ─────────────────────────────────────────────
-- 16. REFERRAL_CODES
-- ─────────────────────────────────────────────
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can read their own referral code"
  ON referral_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "User can create their own referral code"
  ON referral_codes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Validation lookups (by code) done via admin client in register.astro

-- ─────────────────────────────────────────────
-- 17. REFERRALS
-- ─────────────────────────────────────────────
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrer can read their referrals"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid());

CREATE POLICY "Referred user can read their referral"
  ON referrals FOR SELECT
  USING (referred_id = auth.uid());

-- Inserts/updates done via admin client (onboarding)

-- ─────────────────────────────────────────────
-- 18. PET_SHARES
-- ─────────────────────────────────────────────
ALTER TABLE pet_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pet owner can manage shares"
  ON pet_shares FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Co-owner can read their own shares"
  ON pet_shares FOR SELECT
  USING (shared_with = auth.uid());

CREATE POLICY "Co-owner can delete their own share (leave pet)"
  ON pet_shares FOR DELETE
  USING (shared_with = auth.uid());

-- ─────────────────────────────────────────────
-- 19. PET_SHARE_INVITES
-- ─────────────────────────────────────────────
ALTER TABLE pet_share_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inviter can manage their invites"
  ON pet_share_invites FOR ALL
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Anyone authenticated can read invite by token (to accept)"
  ON pet_share_invites FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated user can update invite to accept"
  ON pet_share_invites FOR UPDATE
  USING (auth.uid() IS NOT NULL AND status = 'pending');

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS (if you have pet-photos or similar)
-- ─────────────────────────────────────────────
-- Run these only if you have a 'pet-photos' storage bucket:
--
-- CREATE POLICY "Authenticated users can upload pet photos"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'pet-photos' AND auth.uid() IS NOT NULL);
--
-- CREATE POLICY "Anyone can view pet photos"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'pet-photos');
--
-- CREATE POLICY "Owner can delete their pet photos"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- DONE. Verify with:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- ============================================================
