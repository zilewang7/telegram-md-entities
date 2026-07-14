/**
 * Tier-2 round-trip: send every corpus fixture as { text, entities }; the
 * sendMessage RESPONSE carries the server-normalized entities — deep-compare
 * both sides. Messages are kept in the test chat as a visual render gallery
 * (links logged); set E2E_CLEANUP=1 to delete instead.
 */
import { describe, expect, it } from 'vitest';
import { concatMessages, renderMarkdown } from '../../src/index';
import { loadCorpus } from '../helpers/corpus';
import { createClient } from './helpers/client';
import { readE2eEnv } from './helpers/env';
import { fromResponse, normalizeForCompare } from './helpers/normalize';

const env = readE2eEnv();

describe.skipIf(!env)('e2e round-trip (corpus gallery)', () => {
    const client = env ? createClient(env) : null;

    for (const { name, markdown } of loadCorpus()) {
        it(name, async () => {
            if (!client) return;

            // Bold fixture-name header makes the gallery navigable
            const message = concatMessages(
                { text: `〔${name}〕`, entities: [{ type: 'bold', offset: 0, length: name.length + 2 }] },
                '\n\n',
                renderMarkdown(markdown)
            );

            const response = await client.sendMessage({
                text: message.text,
                entities: message.entities,
            });
            console.log(`  ${name}: ${client.messageLink(response.message_id)}`);

            expect(normalizeForCompare(fromResponse(response))).toEqual(
                normalizeForCompare(message)
            );

            await client.maybeCleanup(response.message_id);
        });
    }
});
