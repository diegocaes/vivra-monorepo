import assert from 'node:assert/strict';

const base = new URL(process.env.SMOKE_BASE_URL || 'http://localhost:4321');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use a local dev server for smoke tests');
for (const path of ['/', '/login', '/privacy', '/terms']) {
  const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, `${path}: expected a public page`);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.match(await response.text(), /<html[\s>]/, `${path}: missing HTML document`);
  process.stdout.write(`PASS ${path}\n`);
}
const protectedPage = await fetch(new URL('/dashboard', base), { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
assert.equal(protectedPage.status, 302, 'Anonymous dashboard must redirect');
assert.equal(new URL(protectedPage.headers.get('location'), base).pathname, '/login');
process.stdout.write('PASS anonymous dashboard redirects to login\n');
const manifest = await fetch(new URL('/manifest.json', base), { signal: AbortSignal.timeout(15_000) });
assert.equal(manifest.status, 200);
assert.ok((await manifest.json()).name, 'PWA manifest must have a name');
process.stdout.write('PASS PWA manifest\n');
