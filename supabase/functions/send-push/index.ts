// Edge function: send-push
//
// Daily server-side push dispatcher. Solves the structural retention gap:
// local notifications only re-schedule when the user OPENS the app, so a
// dormant user stops receiving reminders entirely. This function runs on the
// server every day and pushes what matters via Expo Push API, using the
// push_tokens the mobile app has been collecting.
//
// Notification types (all also inserted in-app into `notifications`):
//   preventive_due   — antipulgas/desparasitante 30-day cycle expired
//   vaccine_due      — >1 year since a vaccine's last dose
//   weight_stale     — >30 days without a weight record (premium feature
//                      in-app, but the push nudge is sent to everyone:
//                      it drives re-engagement either way)
//   re_engagement    — no notification sent AND no data logged in 7+ days
//
// Dedup strategy: before sending, check the `notifications` table for a row
// of the same type+pet within the cooldown window. The same insert that
// powers the in-app inbox doubles as the send-log. No email anywhere.
//
// Invocation: pg_cron + pg_net (see migration) hits this endpoint daily with
// the CRON_SECRET header. Can also be invoked manually for testing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Cooldown (days) per notification type — how long before we repeat the same
// nudge for the same pet/user.
const COOLDOWNS: Record<string, number> = {
  preventive_due: 7,
  vaccine_due: 30,
  weight_stale: 30,
  re_engagement: 14,
};

interface PushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, string>;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const CRON_SECRET = Deno.env.get('CRON_SECRET');

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: 'Missing environment configuration' }, 500);
    }

    // Auth: only the cron (or an operator with the secret) may invoke.
    const provided = req.headers.get('x-cron-secret');
    if (!CRON_SECRET || provided !== CRON_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Load the working set ──────────────────────────────────────────
    // Users with at least one push token, their pets, and the data needed to
    // evaluate each rule. Volumes are small (early-stage app) so we load and
    // evaluate in memory; revisit with SQL-side filtering at >10k users.
    const [tokensRes, petsRes, preventivesRes, vaccinesRes, weightsRes, recentNotifsRes] = await Promise.all([
      admin.from('push_tokens').select('user_id, token, platform'),
      admin.from('pets').select('id, user_id, name'),
      admin.from('preventive_treatments').select('pet_id, type, date_given').order('date_given', { ascending: false }),
      admin.from('vaccines').select('pet_id, name, date_given').order('date_given', { ascending: false }),
      admin.from('weight_records').select('pet_id, date').order('date', { ascending: false }),
      admin.from('notifications').select('user_id, pet_id, type, created_at')
        .gte('created_at', new Date(Date.now() - 35 * 86400000).toISOString()),
    ]);

    const tokens = tokensRes.data ?? [];
    const pets = petsRes.data ?? [];
    if (tokens.length === 0 || pets.length === 0) {
      return json({ ok: true, sent: 0, reason: 'no tokens or pets' }, 200);
    }

    // Index helpers
    const tokensByUser = new Map<string, string[]>();
    for (const t of tokens) {
      if (!t.token?.startsWith('ExponentPushToken')) continue;
      const list = tokensByUser.get(t.user_id) ?? [];
      list.push(t.token);
      tokensByUser.set(t.user_id, list);
    }

    const recentByKey = new Map<string, string>(); // `${user}|${pet}|${type}` → created_at
    for (const n of recentNotifsRes.data ?? []) {
      const key = `${n.user_id}|${n.pet_id ?? ''}|${n.type}`;
      const prev = recentByKey.get(key);
      if (!prev || n.created_at > prev) recentByKey.set(key, n.created_at);
    }

    const lastPreventiveByPetType = new Map<string, string>(); // `${pet}|${type}` → date
    for (const p of preventivesRes.data ?? []) {
      // 'combinado' counts as both
      const types = p.type === 'combinado' ? ['antipulgas', 'desparasitante'] : [p.type];
      for (const ty of types) {
        const key = `${p.pet_id}|${ty}`;
        if (!lastPreventiveByPetType.has(key)) lastPreventiveByPetType.set(key, p.date_given);
      }
    }

    const lastVaccineByPetName = new Map<string, string>(); // `${pet}|${vaccine}` → date
    for (const v of vaccinesRes.data ?? []) {
      const key = `${v.pet_id}|${v.name}`;
      if (!lastVaccineByPetName.has(key)) lastVaccineByPetName.set(key, v.date_given);
    }

    const lastWeightByPet = new Map<string, string>();
    for (const w of weightsRes.data ?? []) {
      if (!lastWeightByPet.has(w.pet_id)) lastWeightByPet.set(w.pet_id, w.date);
    }

    // ── 2. Evaluate rules per pet ────────────────────────────────────────
    type Pending = {
      userId: string;
      petId: string;
      type: string;
      title: string;
      body: string;
      href: string;
      icon: string;
    };
    const pending: Pending[] = [];

    const cooledDown = (userId: string, petId: string, type: string): boolean => {
      const last = recentByKey.get(`${userId}|${petId}|${type}`);
      if (!last) return true;
      return daysSince(last) >= (COOLDOWNS[type] ?? 14);
    };

    for (const pet of pets) {
      if (!tokensByUser.has(pet.user_id)) continue; // no device to push to

      // Rule 1: preventives overdue (30-day cycle)
      for (const ty of ['antipulgas', 'desparasitante'] as const) {
        const last = lastPreventiveByPetType.get(`${pet.id}|${ty}`);
        if (!last) continue; // never registered → the in-app banner handles it
        const days = daysSince(last);
        if (days > 30 && cooledDown(pet.user_id, pet.id, 'preventive_due')) {
          const overdueDays = days - 30;
          pending.push({
            userId: pet.user_id, petId: pet.id, type: 'preventive_due',
            title: `${pet.name}: ${ty} vencido`,
            body: `Hace ${overdueDays} día${overdueDays !== 1 ? 's' : ''} que venció el ${ty} de ${pet.name}. Aplícalo y regístralo.`,
            href: '/salud/preventivos', icon: ty === 'antipulgas' ? '🐛' : '💊',
          });
          break; // one preventive push per pet per run is enough
        }
      }

      // Rule 2: vaccines >1 year
      let worstVaccine: { name: string; days: number } | null = null;
      for (const [key, date] of lastVaccineByPetName) {
        if (!key.startsWith(`${pet.id}|`)) continue;
        const days = daysSince(date);
        if (days > 365 && (!worstVaccine || days > worstVaccine.days)) {
          worstVaccine = { name: key.split('|')[1], days };
        }
      }
      if (worstVaccine && cooledDown(pet.user_id, pet.id, 'vaccine_due')) {
        pending.push({
          userId: pet.user_id, petId: pet.id, type: 'vaccine_due',
          title: `${pet.name}: vacuna pendiente`,
          body: `Hace más de un año de la última dosis de ${worstVaccine.name}. Agenda el refuerzo con tu vet.`,
          href: '/salud/vacunas', icon: '💉',
        });
      }

      // Rule 3: weight stale >30 days
      const lastWeight = lastWeightByPet.get(pet.id);
      if (lastWeight && daysSince(lastWeight) > 30 && cooledDown(pet.user_id, pet.id, 'weight_stale')) {
        pending.push({
          userId: pet.user_id, petId: pet.id, type: 'weight_stale',
          title: `${pet.name}: hora de pesar`,
          body: `Más de 30 días sin registrar el peso de ${pet.name}. Un registro rápido mantiene su historial al día.`,
          href: '/salud/peso', icon: '⚖️',
        });
      }
    }

    // Rule 4: re-engagement — users with tokens whose pets got NO pending
    // nudge above and have logged nothing recent (proxied by: no notification
    // row of any type in 7+ days and no fresh weight/preventive).
    const usersWithPending = new Set(pending.map(p => p.userId));
    for (const [userId] of tokensByUser) {
      if (usersWithPending.has(userId)) continue;
      const userPets = pets.filter(p => p.user_id === userId);
      if (userPets.length === 0) continue;
      const pet = userPets[0];
      if (!cooledDown(userId, pet.id, 're_engagement')) continue;
      // Any in-app notification in the last 7 days? Then they're active enough.
      let recentActivity = false;
      for (const [key, date] of recentByKey) {
        if (key.startsWith(`${userId}|`) && daysSince(date) < 7) { recentActivity = true; break; }
      }
      if (recentActivity) continue;
      pending.push({
        userId, petId: pet.id, type: 're_engagement',
        title: `¿Cómo está ${pet.name}? 🐾`,
        body: `Hace días que no registras nada. Un vistazo rápido mantiene su Vitality Score al día.`,
        href: '/dashboard', icon: '🐾',
      });
    }

    if (pending.length === 0) {
      return json({ ok: true, sent: 0, reason: 'nothing due' }, 200);
    }

    // ── 3. Insert in-app rows (this is also the dedup log) ──────────────
    const { error: insertErr } = await admin.from('notifications').insert(
      pending.map(p => ({
        user_id: p.userId,
        pet_id: p.petId,
        type: p.type,
        title: p.title,
        message: p.body,
        icon: p.icon,
        href: p.href,
        read: false,
        dismissed: false,
      })),
    );
    if (insertErr) {
      console.error('[send-push] in-app insert failed:', insertErr.message);
      // Keep going: better to push without in-app row than neither.
    }

    // ── 4. Send via Expo Push API in chunks of 100 ───────────────────────
    const messages: PushMessage[] = [];
    for (const p of pending) {
      for (const token of tokensByUser.get(p.userId) ?? []) {
        messages.push({
          to: token,
          sound: 'default',
          title: p.title,
          body: p.body,
          data: { type: p.type, href: p.href, petId: p.petId },
        });
      }
    }

    let sent = 0;
    const invalidTokens: string[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      const result = await res.json().catch(() => null);
      const tickets: Array<{ status: string; details?: { error?: string } }> =
        result?.data ?? [];
      tickets.forEach((t, idx) => {
        if (t.status === 'ok') {
          sent++;
        } else if (t.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(chunk[idx].to);
        }
      });
    }

    // ── 5. Prune dead tokens so we stop pushing to uninstalled devices ───
    if (invalidTokens.length > 0) {
      await admin.from('push_tokens').delete().in('token', invalidTokens);
    }

    return json({
      ok: true,
      evaluated: pets.length,
      pending: pending.length,
      sent,
      pruned: invalidTokens.length,
    }, 200);
  } catch (e) {
    console.error('[send-push] unexpected error:', e);
    return json({ error: 'Unexpected server error' }, 500);
  }
});
