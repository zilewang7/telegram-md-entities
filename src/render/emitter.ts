/**
 * Entity emitter: a single UTF-16 cursor over the output text.
 *
 * All entity offsets/lengths are measured in UTF-16 code units (what the Bot
 * API requires); `string.length` in JS is exactly that, so appending text and
 * reading `text.length` is authoritative — surrogate pairs need no special
 * handling here.
 *
 * Block gaps are buffered lazily and flushed on the next visible content, so
 * output never starts with whitespace, never ends with a dangling gap, and
 * entities opened right after a gap never include the gap characters.
 */
import type { EntityType, MessageEntity, RenderedMessage } from '../types';
import { compareEntities } from './normalize-entities';

export interface EntitySpec {
    type: EntityType;
    url?: string;
    language?: string;
}

export interface EntityHandle {
    readonly id: number;
}

export interface Emitter {
    /** Append visible text (flushes any pending block gap first) */
    pushText: (value: string) => void;
    /** Request a separator before the NEXT visible content ('\n\n' wins over '\n') */
    pushGap: (gap: '\n' | '\n\n') => void;
    /** Start an entity at the current cursor (flushes pending gap first) */
    openEntity: (spec: EntitySpec) => EntityHandle;
    /** End an entity; zero-length entities are dropped */
    closeEntity: (handle: EntityHandle) => void;
    /** Current text length in UTF-16 code units */
    cursor: () => number;
    finish: () => RenderedMessage;
}

interface OpenEntity {
    spec: EntitySpec;
    start: number;
}

export const createEmitter = (): Emitter => {
    let text = '';
    let pendingGap = '';
    let nextId = 0;
    const openEntities = new Map<number, OpenEntity>();
    const entities: MessageEntity[] = [];

    const flushGap = (): void => {
        if (pendingGap) {
            text += pendingGap;
            pendingGap = '';
        }
    };

    return {
        pushText: (value: string): void => {
            if (!value) return;
            flushGap();
            text += value;
        },

        pushGap: (gap: '\n' | '\n\n'): void => {
            // No leading gap before the first content
            if (text === '') return;
            if (gap.length > pendingGap.length) {
                pendingGap = gap;
            }
        },

        openEntity: (spec: EntitySpec): EntityHandle => {
            // Do NOT flush the pending gap: if the entity ends up empty the
            // gap must stay unflushed (no dangling separators). Record the
            // position content WILL land at once the gap flushes instead.
            const id = nextId;
            nextId += 1;
            openEntities.set(id, { spec, start: text.length + pendingGap.length });
            return { id };
        },

        closeEntity: (handle: EntityHandle): void => {
            const openEntity = openEntities.get(handle.id);
            if (!openEntity) return;
            openEntities.delete(handle.id);

            const length = text.length - openEntity.start;
            if (length <= 0) return;

            const { type, url, language } = openEntity.spec;
            entities.push({
                type,
                offset: openEntity.start,
                length,
                ...(url !== undefined ? { url } : {}),
                ...(language !== undefined ? { language } : {}),
            });
        },

        cursor: (): number => text.length,

        finish: (): RenderedMessage => {
            // Defensive edge trim: raw html/code values can carry edge
            // whitespace; Telegram server-trims message edges, which would
            // desync our offsets — trim on both sides and shift/clamp
            // entities instead
            const lead = text.match(/^\s+/)?.[0].length ?? 0;
            const body = text.replace(/\s+$/, '').slice(lead);
            const adjusted = entities
                .map((entity) => {
                    const start = Math.max(entity.offset - lead, 0);
                    const end = Math.min(entity.offset + entity.length - lead, body.length);
                    return { ...entity, offset: start, length: end - start };
                })
                .filter((entity) => entity.length > 0);

            // Canonical order: by offset, outer (longer) before inner
            const sorted = adjusted.sort(compareEntities);
            return { text: body, entities: sorted };
        },
    };
};
