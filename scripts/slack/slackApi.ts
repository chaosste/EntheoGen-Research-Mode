import { loadSlackEnv } from './slackEnv.ts';

export interface SlackApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  error?: string;
  response_metadata?: {
    next_cursor?: string;
    warnings?: string[];
  };
  [key: string]: unknown;
}

export interface SlackMessageResponse extends SlackApiResponse {
  channel?: string;
  ts?: string;
  message?: Record<string, unknown>;
}

export interface SlackAuthTestResponse extends SlackApiResponse {
  url?: string;
  team?: string;
  team_id?: string;
  user?: string;
  user_id?: string;
  bot_id?: string;
}

export interface SlackConversation {
  id: string;
  name?: string;
  is_member?: boolean;
  is_archived?: boolean;
  [key: string]: unknown;
}

export interface SlackConversationListResponse extends SlackApiResponse {
  channels?: SlackConversation[];
}

const DEFAULT_SLACK_API_BASE = 'https://slack.com/api';

export function getSlackToken(env = loadSlackEnv()): string {
  const token = env.SLACK_BOT_TOKEN || env.BOT_USER_OAUTH_TOKEN;
  if (!token) {
    throw new Error('Missing SLACK_BOT_TOKEN or BOT_USER_OAUTH_TOKEN');
  }
  return token;
}

function slackApiBase(): string {
  return process.env.SLACK_API_BASE || DEFAULT_SLACK_API_BASE;
}

export async function callSlackApi<T extends SlackApiResponse>(
  method: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(`${slackApiBase()}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSlackToken()}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`Slack API HTTP ${response.status} for ${method}: ${body.error ?? 'unknown_error'}`);
  }
  return body;
}

export async function postMessage(options: {
  channel: string;
  text: string;
  thread_ts?: string;
  reply_broadcast?: boolean;
}): Promise<SlackMessageResponse> {
  return callSlackApi<SlackMessageResponse>('chat.postMessage', options);
}

export async function openDm(userId: string): Promise<SlackApiResponse<{ channel?: { id?: string } }>> {
  return callSlackApi('conversations.open', { users: userId });
}

export async function authTest(): Promise<SlackAuthTestResponse> {
  return callSlackApi<SlackAuthTestResponse>('auth.test');
}

export async function listConversations(options: Record<string, unknown> = {}): Promise<SlackConversationListResponse> {
  return callSlackApi<SlackConversationListResponse>('conversations.list', options);
}

export async function history(options: {
  channel: string;
  latest?: string;
  oldest?: string;
  limit?: number;
  inclusive?: boolean;
}): Promise<SlackApiResponse> {
  return callSlackApi('conversations.history', options);
}

export async function permalink(channel: string, messageTs: string): Promise<SlackApiResponse<{ permalink?: string }>> {
  return callSlackApi('chat.getPermalink', {
    channel,
    message_ts: messageTs,
  });
}

export function buildSlackArchiveUrl(workspaceUrl: string, channel: string, messageTs: string): string {
  const normalizedWorkspace = workspaceUrl.replace(/\/+$/, '');
  const compactTs = messageTs.replace('.', '');
  return `${normalizedWorkspace}/archives/${channel}/p${compactTs}`;
}
