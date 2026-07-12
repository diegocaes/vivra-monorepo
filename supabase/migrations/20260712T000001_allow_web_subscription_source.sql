-- Permite source = 'web' en user_subscriptions (suscripciones vía Paddle en la web).
-- Aditivo: solo amplía los valores permitidos del CHECK.
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_source_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_source_check
  CHECK (source = ANY (ARRAY['referral'::text, 'iap'::text, 'promo'::text, 'trial'::text, 'web'::text]));
