// Operator-only, one-off campaign. No changes to subscriptions or reminder cron.
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const campaign = {
  id: 'vivra-ios-1.3.0-launch',
  title: '¡Vivra se renueva! 🐾',
  body: 'Salud, cuidado y viajes, ahora mejor organizados. Busca Vivra en App Store, actualiza y descubre el nuevo diseño.',
};
const hash = value => createHash('sha256').update(value).digest('hex');

export function selectRecipients(rows) {
  const owners = new Map();
  for (const row of rows) {
    const set = owners.get(row.token) ?? new Set();
    set.add(row.user_id);
    owners.set(row.token, set);
  }
  const users = new Map();
  for (const row of rows) {
    if (row.platform !== 'ios' || owners.get(row.token).size !== 1 ||
      !/^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(row.token)) continue;
    if (!Number.isFinite(Date.parse(row.updated_at))) continue;
    const previous = users.get(row.user_id);
    if (!previous || row.updated_at > previous.updated_at) users.set(row.user_id, row);
  }
  return [...users.values()].sort((a, b) => a.user_id.localeCompare(b.user_id));
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const [mode = 'preview', testEmail] = process.argv.slice(2);
  if (!['preview', 'test', 'send', 'receipts'].includes(mode)) throw new Error('Unknown mode');
  const env = parseEnv(await readFile(new URL('../apps/web/.env', import.meta.url), 'utf8'));
  const base = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Missing backend credentials');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const dir = fileURLToPath(new URL('../output/push-campaigns/', import.meta.url));
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = `${dir}/${campaign.id}.json`;
  // Leave no automatic stale-lock recovery: an operator must first reconcile any interrupted send.
  const lock = await open(`${path}.lock`, 'wx', 0o600);
  try {
    let state;
    try { state = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; state = { campaign, deliveries: {} }; }
    if (JSON.stringify(state.campaign) !== JSON.stringify(campaign)) throw new Error('Campaign payload changed');
    const save = async () => {
      await writeFile(`${path}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
      await rename(`${path}.tmp`, path);
    };
    if (mode === 'receipts') {
      const pending = Object.values(state.deliveries).filter(d => d.ticket && !d.receipt);
      for (let i = 0; i < pending.length; i += 100) {
        const batch = pending.slice(i, i + 100);
        const result = await jsonRequest('https://exp.host/--/api/v2/push/getReceipts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: batch.map(d => d.ticket) }),
        });
        if (!result.data || result.errors) throw new Error('Invalid receipt response');
        for (const d of batch) {
          const receipt = result.data[d.ticket];
          if (receipt) d.receipt = { status: receipt.status, error: receipt.details?.error };
        }
        await save();
      }
      console.log(JSON.stringify({ receipts: Object.values(state.deliveries).map(d => ({ mode: d.mode, status: d.status, receipt: d.receipt ?? 'pending' })) }));
      return;
    }
    const store = await jsonRequest('https://itunes.apple.com/lookup?id=6761087142&country=pa');
    if (!store.results?.some(a => a.trackId === 6761087142 && a.version === '1.3.0')) {
      throw new Error('Public App Store version is not 1.3.0; stop for operator review');
    }
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      if (offset >= 100000) throw new Error('Audience exceeds operator tool limit');
      const page = await jsonRequest(`${base}/rest/v1/push_tokens?select=user_id,token,platform,updated_at&order=user_id,token`, {
        headers: { ...headers, Range: `${offset}-${offset + 999}` },
      });
      if (!Array.isArray(page)) throw new Error('Invalid audience response');
      rows.push(...page);
      if (page.length < 1000) break;
    }
    let recipients = selectRecipients(rows);
    console.log(JSON.stringify({ publicVersion: '1.3.0', registeredDevices: rows.length, selectedUsers: recipients.length, policy: 'one most recently registered iOS device per user', alreadyAttempted: recipients.filter(r => state.deliveries[hash(r.user_id)]).length }));
    if (mode === 'preview') return;
    if (mode === 'test') {
      if (!testEmail) throw new Error('Test requires owner account email');
      let ownerId;
      for (const recipient of recipients) {
        const user = await jsonRequest(`${base}/auth/v1/admin/users/${recipient.user_id}`, { headers });
        if (user.email?.toLowerCase() === testEmail.toLowerCase()) { ownerId = user.id; break; }
      }
      if (!ownerId) throw new Error('Owner account has no eligible iOS token');
      recipients = recipients.filter(r => r.user_id === ownerId);
    } else if (!Object.values(state.deliveries).some(d => d.mode === 'test' && d.receipt?.status === 'ok')) {
      throw new Error('A successful owner test receipt is required before general sending');
    }
    recipients = recipients.filter(r => !state.deliveries[hash(r.user_id)]);
    for (let i = 0; i < recipients.length; i += 100) {
      const batch = recipients.slice(i, i + 100);
      // Reserve before network transmission. Ambiguous failures are NEVER retried automatically.
      for (const r of batch) state.deliveries[hash(r.user_id)] = { tokenHash: hash(r.token), mode, status: 'reserved', at: new Date().toISOString() };
      await save();
      const result = await jsonRequest('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map(r => ({ to: r.token, sound: 'default', title: campaign.title, body: campaign.body, data: { type: 'app_update', href: '/dashboard', campaignId: campaign.id } }))),
      });
      if (result.errors || !Array.isArray(result.data) || result.data.length !== batch.length) throw new Error('Ambiguous push response; inspect reserved deliveries before any further action');
      result.data.forEach((ticket, index) => {
        Object.assign(state.deliveries[hash(batch[index].user_id)], {
          status: ticket.status === 'ok' && ticket.id ? 'accepted' : 'error',
          ticket: ticket.id, error: ticket.details?.error,
        });
      });
      await save();
      console.log(JSON.stringify({ attempted: batch.length, accepted: result.data.filter(t => t.status === 'ok' && t.id).length, errors: result.data.filter(t => t.status !== 'ok').map(t => t.details?.error ?? 'UnknownError') }));
    }
  } finally {
    await lock.close();
    await unlink(`${path}.lock`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
