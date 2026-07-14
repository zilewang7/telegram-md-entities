/**
 * Minimal fetch-based Bot API client for e2e tests: one global serial queue
 * (~1.1s spacing) plus a single retry honoring 429 retry_after. Sent
 * messages are KEPT by default — the test chat doubles as a visual render
 * gallery; set E2E_CLEANUP=1 to delete after asserting.
 */
import type { MessageEntity } from '../../../src/types';
import type { E2eEnv } from './env';

export interface TgMessageLite {
    message_id: number;
    text?: string;
    entities?: Array<Record<string, unknown>>;
}

interface TgResponse {
    ok: boolean;
    result?: unknown;
    description?: string;
    error_code?: number;
    parameters?: { retry_after?: number };
}

const SPACING_MS = 1100;
let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

export interface E2eClient {
    sendMessage: (payload: {
        text: string;
        entities?: MessageEntity[];
        parseMode?: string;
    }) => Promise<TgMessageLite>;
    deleteMessage: (messageId: number) => Promise<void>;
    maybeCleanup: (messageId: number) => Promise<void>;
    messageLink: (messageId: number) => string;
}

export const createClient = (env: E2eEnv): E2eClient => {
    const call = async (method: string, body: Record<string, unknown>): Promise<unknown> => {
        const run = async (): Promise<unknown> => {
            const wait = lastCallAt + SPACING_MS - Date.now();
            if (wait > 0) await sleep(wait);

            const doFetch = async (): Promise<TgResponse> => {
                lastCallAt = Date.now();
                const response = await fetch(`${env.apiBase}/bot${env.token}/${method}`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                });
                return (await response.json()) as TgResponse;
            };

            let result = await doFetch();
            if (!result.ok && result.error_code === 429) {
                await sleep(((result.parameters?.retry_after ?? 3) + 1) * 1000);
                result = await doFetch();
            }
            if (!result.ok) {
                throw new Error(`${method} failed: ${result.error_code} ${result.description}`);
            }
            return result.result;
        };

        const next = queue.then(run, run);
        // Keep the chain alive on failures without swallowing this call's error
        queue = next.then(
            () => undefined,
            () => undefined
        );
        return next;
    };

    return {
        sendMessage: async (payload): Promise<TgMessageLite> => {
            const result = await call('sendMessage', {
                chat_id: env.chatId,
                text: payload.text,
                ...(payload.entities ? { entities: payload.entities } : {}),
                ...(payload.parseMode ? { parse_mode: payload.parseMode } : {}),
                link_preview_options: { is_disabled: true },
            });
            return result as TgMessageLite;
        },

        deleteMessage: async (messageId): Promise<void> => {
            await call('deleteMessage', { chat_id: env.chatId, message_id: messageId });
        },

        maybeCleanup: async (messageId): Promise<void> => {
            if (process.env.E2E_CLEANUP !== '1') return;
            try {
                await call('deleteMessage', { chat_id: env.chatId, message_id: messageId });
            } catch {
                // best-effort cleanup
            }
        },

        messageLink: (messageId): string => {
            const bare = env.chatId.replace(/^-100/, '');
            return `https://t.me/c/${bare}/${messageId}`;
        },
    };
};
