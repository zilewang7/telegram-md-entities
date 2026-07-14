import { describe, expect, it } from 'vitest';
import { renderMarkdown, splitMessage } from '../../src/index';
import { loadCorpus } from '../helpers/corpus';

describe('splitMessage snapshots', () => {
    it('splits repeated real corpus into shaped chunks', () => {
        const source = loadCorpus('real-')
            .map(({ markdown }) => markdown)
            .join('\n\n');
        const rendered = renderMarkdown(`${source}\n\n${source}`);
        const chunks = splitMessage(rendered, { maxLength: 900 });

        expect(
            chunks.map((chunk) => ({
                length: chunk.text.length,
                entityCount: chunk.entities.length,
                head: chunk.text.slice(0, 18),
                tail: chunk.text.slice(-18),
            }))
        ).toMatchSnapshot();
    });
});
