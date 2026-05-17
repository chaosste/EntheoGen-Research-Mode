import assert from 'node:assert/strict';

process.env.SLACK_SKIP_ENV_FILE = '1';

const { buildSlackArchiveUrl, getSlackToken, openDm } = await import('./slackApi.ts');

function resetEnv(): void {
  delete process.env.SLACK_BOT_TOKEN;
  delete process.env.BOT_USER_OAUTH_TOKEN;
}

resetEnv();
process.env.BOT_USER_OAUTH_TOKEN = 'xoxb-alias-token';
assert.equal(getSlackToken(), 'xoxb-alias-token');

resetEnv();
process.env.SLACK_BOT_TOKEN = 'xoxb-canonical-token';
process.env.BOT_USER_OAUTH_TOKEN = 'xoxb-alias-token';
assert.equal(getSlackToken(), 'xoxb-canonical-token');

const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
globalThis.fetch = (async (url, init) => {
  calls.push({
    url: String(url),
    body: JSON.parse(String(init?.body)),
  });

  return new Response(
    JSON.stringify({
      ok: true,
      channel: {
        id: 'D123',
      },
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    },
  );
}) as typeof fetch;

await openDm('U123');
assert.equal(calls[0]?.url, 'https://slack.com/api/conversations.open');
assert.deepEqual(calls[0]?.body, { users: 'U123' });

assert.equal(
  buildSlackArchiveUrl('https://workspace.slack.com/', 'C123', '1777532785.414609'),
  'https://workspace.slack.com/archives/C123/p1777532785414609',
);

console.log('slackApi tests passed');
