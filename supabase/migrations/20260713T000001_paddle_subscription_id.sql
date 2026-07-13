-- Guarda el ID de suscripción de Paddle (sub_...) para poder cancelarla vía API.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;
