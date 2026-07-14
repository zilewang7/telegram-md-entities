import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const corpusDir = fileURLToPath(new URL('../corpus/', import.meta.url));

export interface CorpusEntry {
    name: string;
    markdown: string;
}

export const loadCorpus = (prefix?: string): CorpusEntry[] =>
    readdirSync(corpusDir)
        .filter((file) => file.endsWith('.md') && (!prefix || file.startsWith(prefix)))
        .sort()
        .map((file) => ({
            name: file.replace(/\.md$/, ''),
            markdown: readFileSync(join(corpusDir, file), 'utf8'),
        }));
