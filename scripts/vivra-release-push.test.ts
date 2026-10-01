import { describe, expect, it } from 'vitest';
import { selectRecipients } from './vivra-release-push.mjs';
const row = (user_id: string, token: string, updated_at = '2026-10-01T12:00:00Z', platform = 'ios') => ({ user_id, token, updated_at, platform });
describe('release campaign audience', () => {
  it('sends to only the latest device per user', () => {
    expect(selectRecipients([row('a', 'ExpoPushToken[old]', '2026-09-01T00:00:00Z'), row('a', 'ExponentPushToken[new]')])).toEqual([row('a', 'ExponentPushToken[new]')]);
  });
  it('excludes tokens associated with multiple accounts even across platforms', () => {
    expect(selectRecipients([row('a', 'ExpoPushToken[shared]'), row('b', 'ExpoPushToken[shared]', undefined, 'android')])).toEqual([]);
  });
  it('excludes Android, malformed tokens and invalid registration dates', () => {
    expect(selectRecipients([row('a', 'bad'), row('b', 'ExpoPushToken[b]', undefined, 'android'), row('c', 'ExpoPushToken[c]', 'bad')])).toEqual([]);
  });
});
