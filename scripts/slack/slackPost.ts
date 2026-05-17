import { authTest, buildSlackArchiveUrl, openDm, permalink, postMessage } from './slackApi.ts';
import { loadSlackEnv } from './slackEnv.ts';

interface PostArgs {
  channel?: string;
  dm?: string;
  text?: string;
  thread?: string;
  broadcast?: boolean;
}

function usage(): string {
  return [
    'Usage:',
    '  tsx scripts/slack/slackPost.ts --channel C123 --text "hello"',
    '  tsx scripts/slack/slackPost.ts --dm U123 --text "hello"',
    '  CHANNEL_ID=C123 tsx scripts/slack/slackPost.ts --text "hello"',
  ].join('\n');
}

function parseArgs(argv: string[]): PostArgs {
  const args: PostArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--channel':
        args.channel = argv[++index];
        break;
      case '--dm':
        args.dm = argv[++index];
        break;
      case '--text':
        args.text = argv[++index];
        break;
      case '--thread':
        args.thread = argv[++index];
        break;
      case '--broadcast':
        args.broadcast = true;
        break;
      case '--help':
      case '-h':
        console.log(usage());
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}\n${usage()}`);
    }
  }

  return args;
}

async function resolveChannel(args: PostArgs, env: NodeJS.ProcessEnv): Promise<string> {
  if (args.channel) {
    return args.channel;
  }

  if (args.dm) {
    const opened = await openDm(args.dm);
    if (!opened.ok) {
      throw new Error(`Slack DM open failed: ${opened.error ?? 'unknown_error'}`);
    }
    const channel = (opened.channel as { id?: string } | undefined)?.id;
    if (!channel) {
      throw new Error('Slack DM open did not return a channel id');
    }
    return channel;
  }

  const channel = env.SLACK_CHANNEL_ID || env.CHANNEL_ID;
  if (!channel) {
    throw new Error(`Missing channel. Provide --channel, --dm, CHANNEL_ID, or SLACK_CHANNEL_ID.\n${usage()}`);
  }
  return channel;
}

async function main(): Promise<void> {
  const env = loadSlackEnv();
  const args = parseArgs(process.argv.slice(2));
  if (!args.text) {
    throw new Error(`Missing --text.\n${usage()}`);
  }

  const channel = await resolveChannel(args, env);
  const posted = await postMessage({
    channel,
    text: args.text,
    thread_ts: args.thread,
    reply_broadcast: args.broadcast,
  });

  if (!posted.ok || !posted.channel || !posted.ts) {
    throw new Error(`Slack post failed: ${posted.error ?? 'missing channel or timestamp'}`);
  }

  let url: string | undefined;
  try {
    const permalinkResult = await permalink(posted.channel, posted.ts);
    if (permalinkResult.ok && typeof permalinkResult.permalink === 'string') {
      url = permalinkResult.permalink;
    }
  } catch {
    // Fall back below when Slack rejects permalink lookup.
  }

  if (!url) {
    const auth = await authTest();
    if (auth.ok && auth.url) {
      url = buildSlackArchiveUrl(auth.url, posted.channel, posted.ts);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        channel: posted.channel,
        ts: posted.ts,
        url,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
