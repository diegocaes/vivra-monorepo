// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/pages/register.astro', 'utf8');
const script = page.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];

beforeEach(() => {
  document.body.innerHTML = `
    <form id="google-form-reg">
      <input id="ref-code-google" name="ref_code" type="hidden" />
      <button id="btn-google-reg" name="action" value="google">Google</button>
    </form>
    <input id="ref-code-email" name="ref_code" type="hidden" />
    <details><summary>Tengo un código</summary><input id="ref-code-input" /></details>
  `;
  if (!script) throw new Error('Registration script missing');
  runInNewContext(script, { document });
});

it('applies a manually entered referral to both signup methods on initial page load', () => {
  const input = document.querySelector<HTMLInputElement>('#ref-code-input')!;
  input.value = 'demo-123';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(input.value).toBe('DEMO123');
  for (const id of ['ref-code-google', 'ref-code-email']) {
    expect(document.querySelector<HTMLInputElement>(`#${id}`)?.value).toBe('DEMO123');
  }
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(document.querySelector<HTMLInputElement>('#ref-code-google')?.value).toBe('');
  expect(document.querySelector<HTMLInputElement>('#ref-code-email')?.value).toBe('');
});

it('preserves the Google action when disabling its submit button', () => {
  const form = document.querySelector<HTMLFormElement>('#google-form-reg')!;
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(new FormData(form).get('action')).toBe('google');
  expect(document.querySelector<HTMLButtonElement>('#btn-google-reg')?.disabled).toBe(true);
});
