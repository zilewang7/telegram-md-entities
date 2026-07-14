/**
 * One-time probe (RUN_PROBE=1): how many entities does the server actually
 * keep per message? Sends 150 single-char bold entities and reads back the
 * count from the response; then asserts a lossless round-trip at our
 * DEFAULT_MAX_ENTITIES. Record the observed cap in src/constants.ts.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_ENTITIES } from '../../src/constants';
import type { MessageEntity } from '../../src/types';
import { createClient } from './helpers/client';
import { readE2eEnv } from './helpers/env';
import { fromResponse } from './helpers/normalize';

const env = readE2eEnv();
const enabled = Boolean(env) && process.env.RUN_PROBE === '1';

const boldEveryOther = (count: number): { text: string; entities: MessageEntity[] } => {
    const chars: string[] = [];
    const entities: MessageEntity[] = [];
    for (let i = 0; i < count; i++) {
        chars.push('x');
        entities.push({ type: 'bold', offset: i * 2, length: 1 });
    }
    return { text: chars.join(' '), entities };
};

describe.skipIf(!enabled)('entity limit probe (RUN_PROBE=1)', () => {
    it('reveals the server-side entity cap', async () => {
        if (!env) return;
        const client = createClient(env);

        const oversized = boldEveryOther(150);
        const response = await client.sendMessage(oversized);
        const kept = fromResponse(response).entities.length;
        console.log(`\n  >>> sent 150 entities, server kept ${kept} <<<`);
        console.log(`  ${client.messageLink(response.message_id)}`);
        expect(kept).toBeGreaterThan(0);
    });

    it(`round-trips losslessly at DEFAULT_MAX_ENTITIES (${DEFAULT_MAX_ENTITIES})`, async () => {
        if (!env) return;
        const client = createClient(env);

        const budgeted = boldEveryOther(DEFAULT_MAX_ENTITIES);
        const response = await client.sendMessage(budgeted);
        expect(fromResponse(response).entities.length).toBe(DEFAULT_MAX_ENTITIES);
    });
});
