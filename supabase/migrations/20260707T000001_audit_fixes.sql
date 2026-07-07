-- ═══════════════════════════════════════════════════════════════════
-- Auditoría 2026-07-07 — RPCs faltantes, species, app_events
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. RPCs que el código cliente ya llama pero no existían ──────────

-- Expira el premium propio si venció (llamado on-load por web y mobile)
CREATE OR REPLACE FUNCTION public.expire_my_premium_if_due()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_subscriptions
  SET plan = 'free', source = NULL, updated_at = NOW()
  WHERE user_id = auth.uid()
    AND plan = 'premium'
    AND source IN ('referral', 'trial', 'promo')
    AND premium_until IS NOT NULL
    AND premium_until < NOW();
$$;

-- Sincroniza compra IAP (RevenueCat) → user_subscriptions
CREATE OR REPLACE FUNCTION public.set_iap_premium(
  p_premium_until timestamptz,
  p_iap_product_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO user_subscriptions (user_id, plan, source, premium_until, updated_at)
  VALUES (auth.uid(), 'premium', 'iap', p_premium_until, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET plan = 'premium',
      source = 'iap',
      premium_until = EXCLUDED.premium_until,
      updated_at = NOW();
END;
$$;

-- Limpia filas 'iap' obsoletas cuando RevenueCat dice que ya no hay entitlement
CREATE OR REPLACE FUNCTION public.clear_iap_premium()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_subscriptions
  SET plan = 'free', source = NULL, updated_at = NOW()
  WHERE user_id = auth.uid()
    AND plan = 'premium'
    AND source = 'iap';
$$;

GRANT EXECUTE ON FUNCTION public.expire_my_premium_if_due() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_iap_premium(timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_iap_premium() TO authenticated;

-- ── 2. Especie de la mascota (perro/gato) ────────────────────────────

ALTER TABLE pets ADD COLUMN IF NOT EXISTS species TEXT NOT NULL DEFAULT 'dog'
  CHECK (species IN ('dog', 'cat'));

-- ── 3. Eventos de producto (admin analytics) ─────────────────────────

CREATE TABLE IF NOT EXISTS app_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,               -- ej. 'screen_view', 'click', 'crud'
  name TEXT NOT NULL,                -- ej. 'dashboard', 'add_vaccine'
  platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'ios')),
  props JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_events_created_idx ON app_events (created_at DESC);
CREATE INDEX IF NOT EXISTS app_events_name_idx ON app_events (event, name);

ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados insertan sus propios eventos; anónimos con user_id null.
DROP POLICY IF EXISTS app_events_insert ON app_events;
CREATE POLICY app_events_insert ON app_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS app_events_insert_anon ON app_events;
CREATE POLICY app_events_insert_anon ON app_events FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Sin política SELECT: solo el service role (admin SSR) puede leer.

-- Retención: purgar eventos de más de 180 días (job idempotente)
SELECT cron.schedule(
  'purge-old-app-events',
  '30 4 * * *',
  $$DELETE FROM app_events WHERE created_at < NOW() - INTERVAL '180 days'$$
);
