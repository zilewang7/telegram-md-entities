/**
 * Streaming: make a growing prefix safe to send as a whole rich document,
 * so whatever the caller appends after it (a status line) starts outside
 * every construct. repairTail closes markdown (fences, emphasis, spoilers,
 * half-written links) exactly as the streaming render does; HTML the model
 * left open is closed here: formatting tags on the last line, then
 * <pre>/<ul>/<ol> blocks, then <details> elements.
 */
import { stripPartialTailTag } from '../../render/details';
import type { SpoilerMode } from '../../render/spoiler/micromark-spoiler';
import { scanRawCut } from '../../split/raw-scan';
import { scanBlockState } from '../../streaming/block-scan';
import { repairTail, type TailRepair } from '../../streaming/repair-tail';

export interface ClosedTail {
    source: string;
    /**
     * The closers repairTail appended: source[syntheticStart, syntheticEnd).
     * The parser may refuse to pair some of them; those must not show.
     */
    syntheticStart: number;
    syntheticEnd: number;
}

const closeTag = (name: string): string => `</${name}>`;

/**
 * Closers appended to a marker at a line start can form a fence opener
 * ('~~' + '~~'): the repaired frame would then swallow everything after it.
 * Keep the marker literal instead.
 */
const repairWithoutNewFence = (buffer: string, spoilerMode: SpoilerMode): TailRepair => {
    const repair = repairTail(buffer, { spoilerMode });
    if (repair.appendix === '' || scanBlockState(repair.repaired).openFence === null) return repair;
    return { repaired: repair.repaired.slice(0, -repair.appendix.length), appendix: '' };
};

export const closeStreamingTail = (buffer: string, spoilerMode: SpoilerMode): ClosedTail => {
    const repair = repairWithoutNewFence(buffer, spoilerMode);
    const openDetails = scanRawCut(repair.repaired, repair.repaired.length).details.length;
    // Inside an unclosed <details> the streaming render hides a half-typed
    // tag at the very end; drop it so the appended closers stay whole
    const repaired =
        openDetails > 0 && repair.appendix === '' ? stripPartialTailTag(repair.repaired) : repair.repaired;

    const state = scanRawCut(repaired, repaired.length);
    const inlineClosers = [...state.inlineTags].reverse().map(closeTag).join('');
    const blockClosers = [...state.blockTags].reverse().map((name) => `\n${closeTag(name)}`).join('');
    const detailsClosers = state.details.map(() => '\n</details>').join('');
    return {
        source: repaired + inlineClosers + blockClosers + detailsClosers,
        syntheticStart: repaired.length - repair.appendix.length,
        syntheticEnd: repaired.length,
    };
};
