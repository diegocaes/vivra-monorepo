import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const requiredNode = readFileSync(join(root, '.node-version'), 'utf8').trim();
let failed = false;
function check(label, ok, fix) {
  process.stdout.write(`${ok ? 'OK' : 'MISSING'} ${label}${ok ? '' : ` — ${fix}`}\n`);
  if (!ok) failed = true;
}
check(`Node ${requiredNode} (running ${process.versions.node})`, process.versions.node === requiredNode, 'nvm use');
const pnpm = spawnSync('pnpm', ['--version'], { encoding: 'utf8' });
check('pnpm 9.15.9', pnpm.stdout?.trim() === '9.15.9', 'corepack enable && corepack prepare pnpm@9.15.9 --activate');
check('workspace dependencies', existsSync(join(root, 'node_modules/.pnpm')), 'pnpm install --frozen-lockfile');
for (const [app, keys] of [
  ['web', ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY']],
]) {
  // Check presence only. Never print credentials or copy another worktree's env.
  const path = join(root, 'apps', app, '.env');
  const contents = existsSync(path) ? readFileSync(path, 'utf8') : '';
  for (const key of keys) {
    check(`${app}: ${key}`, Boolean(process.env[key] || new RegExp(`^${key}=.+`, 'm').test(contents)),
      `configure apps/${app}/.env using its .env.example`);
  }
}
process.stdout.write('INFO Mobile uses the configured default backend unless both EXPO_PUBLIC_SUPABASE_* variables are overridden in apps/mobile/.env\n');
const maestro = spawnSync('which', ['maestro'], { encoding: 'utf8' });
process.stdout.write(`${maestro.status === 0 ? 'OK' : 'OPTIONAL'} Maestro for iOS UI verification\n`);
process.exitCode = failed ? 1 : 0;
