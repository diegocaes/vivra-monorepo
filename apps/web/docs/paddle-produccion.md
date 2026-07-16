# Paddle: de sandbox a producción

Estado actual (2026-07-15): el checkout web corre en **sandbox** (`PUBLIC_PADDLE_ENV=sandbox` con token `test_...`). Nadie puede pagar en la web hasta completar esto. El código ya está listo: `premium.astro`, `cancel.ts`, `resume.ts`, `switch-yearly.ts` y la edge function `paddle-webhook` eligen la API live/sandbox según las variables de entorno — **no hay cambios de código pendientes**, solo configuración.

## Pasos manuales (dashboard de Paddle live)

1. **Cuenta live aprobada**: verifica que la cuenta de Paddle (no sandbox) esté aprobada para vender y que `vivrapet.com` esté aprobado como dominio de checkout (Checkout → Website approval).
2. **Crear producto y precios live**: producto "Vivra Premium" con dos precios:
   - Mensual: **$2.99 USD/mes**
   - Anual: **$14.99 USD/año** (igualado al precio de iOS, decisión 2026-07-15)
   Copia los dos `pri_...` live.
   ⚠️ El precio anual del **sandbox** actual está en $19.99 — si sigues probando en sandbox, actualízalo también a $14.99 (o crea un precio nuevo y cambia `PUBLIC_PADDLE_PRICE_YEARLY` en `.env`) para que el cobro coincida con la copy.
3. **Client token live**: Developer Tools → Authentication → crea un client-side token (`live_...`).
4. **API key live**: Developer Tools → Authentication → API key server-side (para cancel/resume/switch-yearly).
5. **Webhook live**: Developer Tools → Notifications → nueva destination:
   - URL: `https://upjiewrirkzhjeciwugg.supabase.co/functions/v1/paddle-webhook`
   - Eventos: `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.resumed`, `subscription.canceled`
   - Copia el **webhook secret**.

## Configuración (una vez tengas los valores)

En **Vercel** (Project → Settings → Environment Variables, scope Production):

```
PUBLIC_PADDLE_ENV=production
PUBLIC_PADDLE_CLIENT_TOKEN=live_...
PUBLIC_PADDLE_PRICE_MONTHLY=pri_...   (live, $2.99/mes)
PUBLIC_PADDLE_PRICE_YEARLY=pri_...    (live, $14.99/año)
PADDLE_API_KEY=...                    (live, server-side)
```

En **Supabase** (secret de la edge function):

```
npx supabase secrets set PADDLE_WEBHOOK_SECRET=<secret live> --project-ref upjiewrirkzhjeciwugg
```

Redeploy en Vercel después de cambiar las variables.

## Precio anual unificado (resuelto 2026-07-15)

- Decisión: **$14.99/año en ambas plataformas** (la web bajó de $19.99 para igualar a iOS).
- La copy de la web (landing, /premium, exit-offer) ya dice $14.99 y "ahorra 58%". Falta que los precios de Paddle (sandbox y live) cobren $14.99.
- El precio que muestra la app iOS sale de App Store Connect vía RevenueCat — no hay que tocar nada en iOS.

## Prueba de humo post-activación

1. En `vivrapet.com/premium` con una cuenta real: comprar el plan mensual con tarjeta real.
2. Verificar en Supabase que `user_subscriptions` tiene la fila con `source='web'`, `plan='premium'` y `paddle_subscription_id`.
3. Verificar que la app iOS muestra premium (sync cross-plataforma).
4. Cancelar desde `/premium` → debe aparecer "cancelada, no se renovará" y `cancel_scheduled_at` en la fila.
5. Reembolsar/cancelar la compra de prueba desde el dashboard de Paddle si aplica.
