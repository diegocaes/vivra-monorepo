-- Fecha en la que una suscripción web (Paddle) dejará de renovarse.
-- NULL = renovación normal. Se setea/limpia desde el webhook (scheduled_change).
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_scheduled_at TIMESTAMPTZ;
