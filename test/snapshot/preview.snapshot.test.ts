import { describe, expect, it } from 'vitest';
import { renderMarkdown, toPreviewHtml } from '../../src/index';
import { loadCorpus } from '../helpers/corpus';

describe('toPreviewHtml corpus snapshots', () => {
    for (const { name, markdown } of loadCorpus()) {
        it(name, async () => {
            const html = toPreviewHtml(renderMarkdown(markdown), { includeStyles: false });
            await expect(html).toMatchFileSnapshot(`./__snapshots__/html/${name}.html`);
        });
    }
});
