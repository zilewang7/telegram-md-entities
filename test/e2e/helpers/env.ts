import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface E2eEnv {
    token: string;
    chatId: string;
    apiBase: string;
}

/** Minimal .env parser — the package root .env carries the test credentials */
const loadDotEnv = (): Record<string, string> => {
    const path = fileURLToPath(new URL('../../../.env', import.meta.url));
    if (!existsSync(path)) return {};
    const result: Record<string, string> = {};
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match?.[1] && match[2] !== undefined) {
            result[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    }
    return result;
};

/** Accept luoxu-style bare supergroup ids: 2311128579 → -1002311128579 */
const toBotApiChatId = (chatId: string): string =>
    /^\d{9,}$/.test(chatId) ? `-100${chatId}` : chatId;

export const readE2eEnv = (): E2eEnv | undefined => {
    const fileEnv = loadDotEnv();
    const token = process.env.TEST_BOT_TOKEN ?? fileEnv.TEST_BOT_TOKEN;
    const chatId = process.env.TEST_CHAT_ID ?? fileEnv.TEST_CHAT_ID;
    if (!token || !chatId) return undefined;
    return {
        token,
        chatId: toBotApiChatId(chatId),
        apiBase:
            process.env.TEST_API_BASE ?? fileEnv.TEST_API_BASE ?? 'https://api.telegram.org',
    };
};
