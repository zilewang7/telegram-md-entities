/**
 * Tier-2 split round-trip: a long document split into chunks, each sent and
 * round-trip-compared; the gallery shows formatting continuing seamlessly
 * across messages (spanning bold reopened, pre keeps highlighting).
 */
import { describe, expect, it } from 'vitest';
import { renderMarkdown, splitMessage } from '../../src/index';
import { loadCorpus } from '../helpers/corpus';
import { createClient } from './helpers/client';
import { readE2eEnv } from './helpers/env';
import { fromResponse, normalizeForCompare } from './helpers/normalize';

const env = readE2eEnv();

describe.skipIf(!env)('e2e split round-trip', () => {
    it('sends a long split document, every chunk round-trips', async () => {
        if (!env) return;
        const client = createClient(env);

        const joined = loadCorpus()
            .map(({ markdown }) => markdown)
            .join('\n\n');
        const rendered = renderMarkdown(`${joined}\n\n${joined}\n\n${joined}`);
        const chunks = splitMessage(rendered, { maxLength: 3900 });
        expect(chunks.length).toBeGreaterThan(1);

        for (const [index, chunk] of chunks.entries()) {
            const response = await client.sendMessage({
                text: chunk.text,
                entities: chunk.entities,
            });
            console.log(
                `  chunk ${index + 1}/${chunks.length} (${chunk.text.length} units, ${chunk.entities.length} entities): ${client.messageLink(response.message_id)}`
            );
            expect(normalizeForCompare(fromResponse(response))).toEqual(
                normalizeForCompare(chunk)
            );
            await client.maybeCleanup(response.message_id);
        }
    });
});
