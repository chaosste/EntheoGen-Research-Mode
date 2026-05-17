import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

const ENV_FILES = ['.env', path.join('src', '.env')];

const ALIASES: Array<[string, string]> = [
  ['CLIENT-ID', 'CLIENT_ID'],
  ['BOT_USER_OAUTH_TOKEN', 'SLACK_BOT_TOKEN'],
  ['CHANNEL_ID', 'SLACK_CHANNEL_ID'],
];

function setIfMissing(key: string, value: string | undefined): void {
  if (value === undefined || value === '') {
    return;
  }
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}

function normalizeAliases(source: NodeJS.ProcessEnv): void {
  for (const [alias, canonical] of ALIASES) {
    setIfMissing(canonical, source[alias]);
  }
}

export function loadSlackEnv(cwd = process.cwd()): NodeJS.ProcessEnv {
  if (process.env.SLACK_SKIP_ENV_FILE !== '1') {
    for (const envFile of ENV_FILES) {
      const envPath = path.resolve(cwd, envFile);
      if (!fs.existsSync(envPath)) {
        continue;
      }

      const parsed = dotenv.parse(fs.readFileSync(envPath));
      for (const [key, value] of Object.entries(parsed)) {
        setIfMissing(key, value);
      }
      normalizeAliases(parsed as NodeJS.ProcessEnv);
    }
  }

  normalizeAliases(process.env);
  return process.env;
}
