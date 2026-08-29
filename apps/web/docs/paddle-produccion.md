# Paddle: de sandbox a producción

Estado actual (2026-07-15): el checkout web corre en **sandbox** (`PUBLIC_PADDLE_ENV=sandbox` con token `test_...`). Nadie puede pagar en la web hasta completar esto. El código ya está listo: `premium.astro`, `cancel.ts`, `resume.ts`, `switch-yearly.ts` y la edge function `paddle-webhook` eligen la API live/sandbox según las variables de entorno — **no hay cambios de código pendientes**, solo configuración.

## Pasos manuales (dashboard de Paddle live)

1. **Cuenta live aprobada**: verifica que la cuenta de Paddle (no sandbox) esté aprobada para vender y que `vivrapet.com` esté aprobado como dominio de checkout (Checkout → Website approval).
2. **Crear producto y precios live**: producto "Vivra Premium" con dos precios:
   - Mensual: **$2.99 USD/mes**
   - Anual: **$19.99 USD/año** (igual al precio aprobado que Apple muestra en EE. UU.)
   Copia los dos `pri_...` live.
   El precio anual del **sandbox** actual ya está en $19.99. Verifica que el `pri_...` live cobre lo mismo antes de habilitar producción.
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
PUBLIC_PADDLE_PRICE_YEARLY=pri_...    (live, $19.99/año)
PADDLE_API_KEY=...                    (live, server-side)
```

En **Supabase** (secret de la edge function):

```
npx supabase secrets set PADDLE_WEBHOOK_SECRET=<secret live> --project-ref upjiewrirkzhjeciwugg
```

Redeploy en Vercel después de cambiar las variables.

## Precio anual unificado (auditado 2026-08-29)

- Fuente comprobada: Apple cobra **$19.99/año** y **$2.99/mes** en la tienda de EE. UU.; localiza esos importes por país (por ejemplo, en COP en Colombia).
- La copy web usa esos importes USD y calcula **44% de ahorro** frente a 12 pagos mensuales. Paddle live debe configurarse con los mismos precios base; no se hacen conversiones manuales de moneda en Vivra.
- El precio que muestra la app iOS sale de App Store Connect vía RevenueCat — no hay que tocar nada en iOS.

## Prueba de humo post-activación

1. En `vivrapet.com/premium` con una cuenta real: comprar el plan mensual con tarjeta real.
2. Verificar en Supabase que `user_subscriptions` tiene la fila con `source='web'`, `plan='premium'` y `paddle_subscription_id`.
3. Verificar que la app iOS muestra premium (sync cross-plataforma).
4. Cancelar desde `/premium` → debe aparecer "cancelada, no se renovará" y `cancel_scheduled_at` en la fila.
5. Reembolsar/cancelar la compra de prueba desde el dashboard de Paddle si aplica.
