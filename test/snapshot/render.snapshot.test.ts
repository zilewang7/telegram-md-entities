import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/index';
import { loadCorpus } from '../helpers/corpus';

describe('renderMarkdown corpus snapshots', () => {
    for (const { name, markdown } of loadCorpus()) {
        it(name, () => {
            expect(renderMarkdown(markdown)).toMatchSnapshot();
        });
    }
});
