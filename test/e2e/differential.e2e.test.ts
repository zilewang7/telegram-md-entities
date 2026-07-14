/**
 * Differential report (RUN_DIFFERENTIAL=1): the same corpus through
 * telegramify-markdown + parse_mode (path A) vs our entities (path B).
 * Informational — prints per-fixture outcomes; the only hard assertion is
 * that path B never fails.
 */
import { describe, expect, it } from 'vitest';
import telegramifyMarkdown from 'telegramify-markdown';
import { renderMarkdown } from '../../src/index';
import { loadCorpus } from '../helpers/corpus';
import { createClient } from './helpers/client';
import { readE2eEnv } from './helpers/env';

const env = readE2eEnv();
const enabled = Boolean(env) && process.env.RUN_DIFFERENTIAL === '1';

describe.skipIf(!enabled)('differential: MarkdownV2 pipeline vs entities (RUN_DIFFERENTIAL=1)', () => {
    it('runs the whole corpus through both pipelines', async () => {
        if (!env) return;
        const client = createClient(env);
        const report: string[] = [];
        let pathAFailures = 0;

        for (const { name, markdown } of loadCorpus()) {
            let pathAResult = 'ok';
            try {
                const markdownV2 = telegramifyMarkdown(markdown, 'escape');
                await client.sendMessage({ text: markdownV2, parseMode: 'MarkdownV2' });
            } catch (error) {
                pathAFailures += 1;
                pathAResult = `FAILED: ${error instanceof Error ? error.message : String(error)}`;
            }

            const rendered = renderMarkdown(markdown);
            const responseB = await client.sendMessage({
                text: rendered.text,
                entities: rendered.entities,
            });
            report.push(
                `${name}\n  A(MarkdownV2): ${pathAResult}\n  B(entities):   ok ${client.messageLink(responseB.message_id)}`
            );
        }

        console.log(`\n===== differential report (path A failures: ${pathAFailures}) =====`);
        for (const line of report) console.log(line);

        // Hard assertion: OUR pipeline never fails. Path A failures are the
        // point of the comparison, not an error.
        expect(true).toBe(true);
    });
});
