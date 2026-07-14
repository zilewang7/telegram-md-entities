/**
 * Streaming tail repair: turn a growing prefix of a markdown document into
 * a parseable snapshot whose unclosed constructs render as their intended
 * formatting. One real parse per tick; on a complete document the buffer
 * passes through untouched, so streaming output converges byte-for-byte
 * with the strict render.
 */
import { scanBlockState } from './block-scan';
import { scanInlineTail, type OpenInline } from './inline-scan';

export interface TailRepair {
    repaired: string;
    /** Synthetic closers appended (empty when nothing was open) */
    appendix: string;
}

const closerFor = (entry: OpenInline): string =>
    entry.marker === '~~' || entry.marker === '||'
        ? entry.marker
        : entry.marker.repeat(entry.size);

export const repairTail = (buffer: string): TailRepair => {
    const block = scanBlockState(buffer);

    if (block.openFence) {
        const { marker, size, containerPrefix } = block.openFence;
        const newline = buffer.endsWith('\n') ? '' : '\n';
        const closer = `${newline}${containerPrefix}${marker.repeat(size)}`;
        return { repaired: buffer + closer, appendix: '' };
    }

    const { splicedBuffer, openStack } = scanInlineTail(buffer, block.leafBlockStart);
    const appendix = [...openStack].reverse().map(closerFor).join('');
    return { repaired: splicedBuffer + appendix, appendix };
};
