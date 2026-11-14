/**
 * Runtime guards for rich-message input. The block/inline trees come from
 * JSON the server keeps extending, so the renderers check shapes instead of
 * trusting the static types: a node they do not know degrades, never throws.
 */
import type { RichBlockNode, RichTextNode } from './rich-types';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Anything the inline renderer can walk: a string, an array or an object
 * (unknown objects render their `text`, else nothing).
 */
export const isRichTextLike = (value: unknown): value is RichTextNode =>
    typeof value === 'string' || Array.isArray(value) || isRecord(value);

/** An object with a string `type`: the block renderer handles any of these */
export const isRichBlockLike = (value: unknown): value is RichBlockNode =>
    isRecord(value) && typeof value.type === 'string';
