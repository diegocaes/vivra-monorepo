// Edge function: send-push
//
// Daily server-side push dispatcher. Solves the structural retention gap:
// local notifications only re-schedule when the user OPENS the app, so a
// dormant user stops receiving reminders entirely. This function runs on the
// server every day and pushes what matters via Expo Push API, using the
// push_tokens the mobile app has been collecting.
//
// REGLAS DE NOTIFICACIÓN (todas también se insertan in-app en `notifications`):
//   preventive_due   — antipulgas/desparasitante: uses `next_due`, or the
//                      dog's calendar-month default when it is missing.
//                      Cat cadence remains explicit. Cooldown 7d.
//   vaccine_due      — only from a confirmed `next_due`: 7 days before and
//                      when due. Cooldown 30d.
//   food_low         — bolsa activa (sin end_date, con bag_size y daily_grams):
//                      avisa cuando quedan ≤4 días de comida. Cooldown 7d.
//   weight_stale     — >30 días sin registro de peso. Cooldown 30d.
//   birthday         — cumpleaños de la mascota (birth_date). Cooldown 300d.
//   re_engagement    — sin actividad ni notificaciones en 7+ días. Cooldown 14d.
//
// Dedup strategy: before sending, check the `notifications` table for a row
// of the same type+pet within the cooldown window. The same insert that
// powers the in-app inbox doubles as the send-log. No email anywhere.
//
// Invocation: pg_cron + pg_net (see migration) hits this endpoint daily with
// the CRON_SECRET header. Can also be invoked manually for testing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function normalizedVaccineName(name: string): string {
  return name.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Cooldown (days) per notification type — how long before we repeat the same
// nudge for the same pet/user.
const COOLDOWNS: Record<string, number> = {
  preventive_due: 7,
  vaccine_due: 30,
  food_low: 7,
  weight_stale: 30,
  birthday: 300,
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

function addMonthsToDate(dateStr: string, months: number): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
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
    const [tokensRes, petsRes, preventivesRes, vaccinesRes, weightsRes, foodsRes, recentNotifsRes] = await Promise.all([
      admin.from('push_tokens').select('user_id, token, platform'),
      admin.from('pets').select('id, user_id, name, birth_date, species'),
      admin.from('preventive_treatments').select('pet_id, type, date_given, next_due').order('date_given', { ascending: false }),
      admin.from('vaccines').select('pet_id, name, next_due').order('date_given', { ascending: false }),
      admin.from('weight_records').select('pet_id, date').order('date', { ascending: false }),
      admin.from('foods').select('pet_id, brand, daily_grams, bag_size, bag_unit, start_date, end_date, created_at')
        .is('end_date', null).order('created_at', { ascending: false }),
      admin.from('notifications').select('user_id, pet_id, type, created_at')
        .gte('created_at', new Date(Date.now() - 310 * 86400000).toISOString()),
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

    const speciesByPetId = new Map(pets.map(pet => [pet.id, pet.species]));

    const recentByKey = new Map<string, string>(); // `${user}|${pet}|${type}` → created_at
    for (const n of recentNotifsRes.data ?? []) {
      const key = `${n.user_id}|${n.pet_id ?? ''}|${n.type}`;
      const prev = recentByKey.get(key);
      if (!prev || n.created_at > prev) recentByKey.set(key, n.created_at);
    }

    const lastPreventiveByPetType = new Map<string, { next_due: string | null }>();
    for (const p of preventivesRes.data ?? []) {
      // 'combinado' counts as both
      const types = p.type === 'combinado' ? ['antipulgas', 'desparasitante'] : [p.type];
      for (const ty of types) {
        const key = `${p.pet_id}|${ty}`;
        if (!lastPreventiveByPetType.has(key)) {
          const nextDue = p.next_due ?? (
            speciesByPetId.get(p.pet_id) === 'dog' ? addMonthsToDate(p.date_given, 1) : null
          );
          lastPreventiveByPetType.set(key, { next_due: nextDue });
        }
      }
    }

    const lastVaccineByPetName = new Map<string, { name: string; next_due: string | null }>(); // `${pet}|${normalized vaccine}`
    for (const v of vaccinesRes.data ?? []) {
      const key = `${v.pet_id}|${normalizedVaccineName(v.name)}`;
      if (!lastVaccineByPetName.has(key)) lastVaccineByPetName.set(key, { name: v.name, next_due: v.next_due });
    }

    const lastWeightByPet = new Map<string, string>();
    for (const w of weightsRes.data ?? []) {
      if (!lastWeightByPet.has(w.pet_id)) lastWeightByPet.set(w.pet_id, w.date);
    }

    // Bolsa activa más reciente por mascota (query ya filtra end_date IS NULL
    // y ordena por created_at desc)
    const activeFoodByPet = new Map<string, { brand: string | null; daily_grams: number | null; bag_size: number | null; bag_unit: string | null; start_date: string | null; created_at: string | null }>();
    for (const f of foodsRes.data ?? []) {
      if (!activeFoodByPet.has(f.pet_id)) activeFoodByPet.set(f.pet_id, f);
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

      // Rule 1: preventives due from a confirmed next date.
      for (const ty of ['antipulgas', 'desparasitante'] as const) {
        const last = lastPreventiveByPetType.get(`${pet.id}|${ty}`);
        if (!last?.next_due) continue;
        const daysToDue = -daysSince(last.next_due);
        if (daysToDue <= 0 && cooledDown(pet.user_id, pet.id, 'preventive_due')) {
          const overdueDays = Math.abs(daysToDue);
          pending.push({
            userId: pet.user_id, petId: pet.id, type: 'preventive_due',
            title: daysToDue < 0 ? `${pet.name}: ${ty} vencido` : `${pet.name}: ${ty} pendiente`,
            body: daysToDue < 0
              ? `Hace ${overdueDays} día${overdueDays !== 1 ? 's' : ''} que venció el ${ty} de ${pet.name}. Aplícalo y regístralo.`
              : `Hoy corresponde el ${ty} de ${pet.name}. Confirma la aplicación y regístrala.`,
            href: '/salud/preventivos', icon: ty === 'antipulgas' ? 'preventivo' : 'pastilla',
          });
          break; // one preventive push per pet per run is enough
        }
      }

      // Rule 2: vaccines — only with a confirmed next_due date.
      let worstVaccine: { name: string; body: string; score: number } | null = null;
      for (const [key, v] of lastVaccineByPetName) {
        if (!key.startsWith(`${pet.id}|`)) continue;
        const name = v.name;
        if (v.next_due) {
          const daysToDue = -daysSince(v.next_due); // positivo = faltan días
          if (daysToDue <= 7) {
            const body = daysToDue > 0
              ? `${name} de ${pet.name} tiene una próxima fecha en ${daysToDue} día${daysToDue !== 1 ? 's' : ''}. Confírmala con tu vet.`
              : `La próxima fecha registrada para ${name} de ${pet.name} ya pasó. Confirma el refuerzo con tu vet.`;
            const score = 1000 - daysToDue; // más vencida = más prioridad
            if (!worstVaccine || score > worstVaccine.score) worstVaccine = { name, body, score };
          }
        }
      }
      if (worstVaccine && cooledDown(pet.user_id, pet.id, 'vaccine_due')) {
        pending.push({
          userId: pet.user_id, petId: pet.id, type: 'vaccine_due',
          title: `${pet.name}: vacuna pendiente`,
          body: worstVaccine.body,
          href: '/salud/vacunas', icon: 'vacuna',
        });
      }

      // Rule 3: comida por acabarse — bolsa activa con ración y tamaño conocidos
      const food = activeFoodByPet.get(pet.id);
      if (food && food.daily_grams && food.bag_size && cooledDown(pet.user_id, pet.id, 'food_low')) {
        const bagGrams = food.bag_unit === 'g' ? food.bag_size
          : food.bag_unit === 'lb' ? food.bag_size * 453.6
          : food.bag_size * 1000; // default kg
        const startedAt = food.start_date ?? food.created_at?.slice(0, 10);
        if (startedAt) {
          const daysUsed = daysSince(startedAt);
          const daysLeft = Math.floor(bagGrams / food.daily_grams) - daysUsed;
          if (daysLeft <= 4 && daysLeft >= -7) { // avisa a tiempo; si pasó mucho, el dato está viejo — no spamear
            pending.push({
              userId: pet.user_id, petId: pet.id, type: 'food_low',
              title: `${pet.name}: comida por acabarse`,
              body: daysLeft > 0
                ? `La bolsa de ${food.brand ?? 'alimento'} rinde ~${daysLeft} día${daysLeft !== 1 ? 's' : ''} más. Buen momento para comprar la siguiente.`
                : `Según la ración diaria, la bolsa de ${food.brand ?? 'alimento'} ya debió acabarse. Registra la nueva para mantener el historial al día.`,
              href: '/alimentacion', icon: 'comida',
            });
          }
        }
      }

      // Rule 4: weight stale >30 days
      const lastWeight = lastWeightByPet.get(pet.id);
      if (lastWeight && daysSince(lastWeight) > 30 && cooledDown(pet.user_id, pet.id, 'weight_stale')) {
        pending.push({
          userId: pet.user_id, petId: pet.id, type: 'weight_stale',
          title: `${pet.name}: hora de pesar`,
          body: `Más de 30 días sin registrar el peso de ${pet.name}. Un registro rápido mantiene su historial al día.`,
          href: '/salud/peso', icon: 'peso',
        });
      }

      // Rule 5: cumpleaños 🎂
      if (pet.birth_date && cooledDown(pet.user_id, pet.id, 'birthday')) {
        const birth = new Date(`${pet.birth_date}T00:00:00`);
        const today = new Date();
        if (birth.getMonth() === today.getMonth() && birth.getDate() === today.getDate()) {
          const age = today.getFullYear() - birth.getFullYear();
          pending.push({
            userId: pet.user_id, petId: pet.id, type: 'birthday',
            title: `¡Feliz cumpleaños, ${pet.name}!`,
            body: `${pet.name} cumple ${age} ${age === 1 ? 'año' : 'años'} hoy. ¡Dale un premio de nuestra parte!`,
            href: '/dashboard', icon: 'cumpleanos',
          });
        }
      }
    }

    // Rule 6: re-engagement — users with tokens whose pets got NO pending
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
        title: `¿Cómo está ${pet.name}?`,
        body: `Hace días que no registras nada. Un vistazo rápido mantiene su Vitality Score al día.`,
        href: '/dashboard', icon: 'mascota',
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
