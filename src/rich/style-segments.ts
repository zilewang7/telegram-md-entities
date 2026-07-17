/**
 * Display-equivalent canonical form: per-character style sets, RLE-compressed
 * into segments. Entities may be freely split/merged (the server does this in
 * its internal representation — e.g. italic containing bold can come back as
 * two italics); what is invariant is which styles cover each character. This
 * is the referee for reverse-pipeline round-trips:
 *   styleSegments(renderMarkdown(entitiesToMarkdown(msg))) ≅ styleSegments(msg)
 */
import { normalizeEntities } from '../render/normalize-entities';
import type { RenderedMessage } from '../types';

export interface StyleSegment {
    text: string;
    styles: string[];
}

export const styleSegments = (message: RenderedMessage): StyleSegment[] => {
    const { text, entities } = message;
    const styleAt: string[][] = Array.from({ length: text.length }, () => []);

    for (const entity of normalizeEntities(entities)) {
        const atom =
            entity.type +
            (entity.url !== undefined ? `:${entity.url.replace(/\/$/, '')}` : '') +
            (entity.language !== undefined ? `:${entity.language}` : '');
        const end = Math.min(entity.offset + entity.length, text.length);
        for (let i = Math.max(0, entity.offset); i < end; i++) {
            styleAt[i]?.push(atom);
        }
    }

    const segments: StyleSegment[] = [];
    for (let i = 0; i < text.length; i++) {
        const styles = [...(styleAt[i] ?? [])].sort();
        const key = styles.join('|');
        const previous = segments[segments.length - 1];
        if (previous && previous.styles.join('|') === key) {
            previous.text += text[i] ?? '';
        } else {
            segments.push({ text: text[i] ?? '', styles });
        }
    }
    return segments;
};
