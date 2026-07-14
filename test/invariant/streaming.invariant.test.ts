import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/index';
import { loadCorpus } from '../helpers/corpus';
import { expectWellFormed } from '../helpers/assertions';

describe('streaming render invariants', () => {
    it('converges with strict render on complete corpus documents', () => {
        for (const { name, markdown } of loadCorpus()) {
            const strict = renderMarkdown(markdown);
            const streaming = renderMarkdown(markdown, { streaming: true });
            expect(streaming, name).toEqual(strict);
        }
    });

    it('every prefix of every corpus document renders well-formed', () => {
        for (const { markdown } of loadCorpus()) {
            const step = Math.max(1, Math.floor(markdown.length / 60));
            for (let end = 1; end <= markdown.length; end += step) {
                expectWellFormed(renderMarkdown(markdown.slice(0, end), { streaming: true }));
            }
            // The very tail, densely: cuts inside trailing constructs
            for (let end = Math.max(1, markdown.length - 20); end <= markdown.length; end++) {
                expectWellFormed(renderMarkdown(markdown.slice(0, end), { streaming: true }));
            }
        }
    });

    it('never throws on arbitrary buffers in streaming mode', () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 400 }), (input) => {
                expectWellFormed(renderMarkdown(input, { streaming: true }));
            }),
            { numRuns: 300 }
        );
    });
});
