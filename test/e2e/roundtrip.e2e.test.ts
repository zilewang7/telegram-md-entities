/**
 * Tier-2 round-trip: send corpus fixtures as { text, entities }; the
 * sendMessage RESPONSE carries the server-normalized entities — deep-compare
 * both sides. Messages are kept in the test chat as a visual render gallery
 * (links logged); set E2E_CLEANUP=1 to delete instead.
 *
 * Default (quick): fixtures are greedily packed into a few combined
 * messages — same per-fixture rendering and the same server comparison,
 * a fraction of the sends. E2E_FULL=1 sends every fixture individually
 * (one gallery message per fixture).
 */
import { describe, expect, it } from 'vitest';
import { concatMessages, renderMarkdown, type RenderedMessage } from '../../src/index';
import { loadCorpus } from '../helpers/corpus';
import { createClient } from './helpers/client';
import { readE2eEnv } from './helpers/env';
import { fromResponse, normalizeForCompare } from './helpers/normalize';

const env = readE2eEnv();
const FULL = process.env.E2E_FULL === '1';

// Stay well inside Telegram's 4096-char / ~100-entity message limits
const PACK_MAX_CHARS = 3500;
const PACK_MAX_ENTITIES = 80;

interface GalleryEntry {
    name: string;
    message: RenderedMessage;
}

const renderEntry = (name: string, markdown: string): GalleryEntry => ({
    name,
    // Bold fixture-name header makes the gallery navigable
    message: concatMessages(
        { text: `〔${name}〕`, entities: [{ type: 'bold', offset: 0, length: name.length + 2 }] },
        '\n\n',
        renderMarkdown(markdown)
    ),
});

const packEntries = (entries: GalleryEntry[]): GalleryEntry[][] => {
    const batches: GalleryEntry[][] = [];
    let current: GalleryEntry[] = [];
    let chars = 0;
    let entityCount = 0;
    for (const entry of entries) {
        const nextChars = chars + entry.message.text.length + 2;
        const nextEntities = entityCount + entry.message.entities.length;
        if (current.length > 0 && (nextChars > PACK_MAX_CHARS || nextEntities > PACK_MAX_ENTITIES)) {
            batches.push(current);
            current = [];
            chars = 0;
            entityCount = 0;
        }
        current.push(entry);
        chars += entry.message.text.length + 2;
        entityCount += entry.message.entities.length;
    }
    if (current.length > 0) batches.push(current);
    return batches;
};

describe.skipIf(!env)('e2e round-trip (corpus gallery)', () => {
    const client = env ? createClient(env) : null;

    const entries = loadCorpus().map(({ name, markdown }) => renderEntry(name, markdown));
    const batches = FULL ? entries.map((entry) => [entry]) : packEntries(entries);

    for (const batch of batches) {
        const title = batch.map((entry) => entry.name).join(' + ');
        it(title, async () => {
            if (!client) return;

            const message =
                batch.length === 1 && batch[0]
                    ? batch[0].message
                    : concatMessages(
                          ...batch.flatMap((entry, index): Array<RenderedMessage | string> =>
                              index === 0 ? [entry.message] : ['\n\n', entry.message]
                          )
                      );

            const response = await client.sendMessage({
                text: message.text,
                entities: message.entities,
            });
            console.log(`  ${title}: ${client.messageLink(response.message_id)}`);

            expect(normalizeForCompare(fromResponse(response))).toEqual(
                normalizeForCompare(message)
            );

            await client.maybeCleanup(response.message_id);
        });
    }
});
