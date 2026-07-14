/**
 * Offline validation against Bot API entity rules: offsets, UTF-16
 * alignment, containment and nesting legality. Returns issues instead of
 * throwing so it can double as a test assertion and a consumer safety net.
 *
 * Nesting model (practical reading of the Bot API docs, to be re-checked
 * against the e2e round-trip):
 * - pre / code contain nothing
 * - blockquote / expandable_blockquote are top-level only and cannot nest
 *   in each other; they may contain any non-blockquote entity
 * - formatting entities (bold/italic/underline/strikethrough/spoiler) and
 *   text_link may contain anything except blockquotes
 */
import type {
    EntityType,
    MessageEntity,
    RenderedMessage,
    ValidationIssue,
} from '../types';
import { DEFAULT_MAX_LENGTH } from '../constants';
import { compareEntities } from '../render/normalize-entities';

const isQuote = (type: EntityType): boolean =>
    type === 'blockquote' || type === 'expandable_blockquote';

const isOpaque = (type: EntityType): boolean => type === 'pre' || type === 'code';

const splitsSurrogatePair = (text: string, index: number): boolean =>
    index > 0 &&
    index < text.length &&
    (text.charCodeAt(index - 1) & 0xfc00) === 0xd800 &&
    (text.charCodeAt(index) & 0xfc00) === 0xdc00;

export const validateMessage = (message: RenderedMessage): ValidationIssue[] => {
    const { text, entities } = message;
    const issues: ValidationIssue[] = [];

    if (text.length > DEFAULT_MAX_LENGTH) {
        issues.push({
            code: 'text-too-long',
            message: `text is ${text.length} UTF-16 units (limit ${DEFAULT_MAX_LENGTH}); split before sending`,
        });
    }
    if (entities.length > 100) {
        issues.push({
            code: 'too-many-entities',
            message: `${entities.length} entities; Telegram silently drops entities past ~100`,
        });
    }

    entities.forEach((entity, entityIndex) => {
        const end = entity.offset + entity.length;
        if (entity.length <= 0) {
            issues.push({
                code: 'zero-length',
                message: `entity #${entityIndex} (${entity.type}) has non-positive length`,
                entityIndex,
            });
            return;
        }
        if (entity.offset < 0) {
            issues.push({
                code: 'offset-out-of-bounds',
                message: `entity #${entityIndex} (${entity.type}) offset ${entity.offset} < 0`,
                entityIndex,
            });
            return;
        }
        if (end > text.length) {
            issues.push({
                code: 'length-out-of-bounds',
                message: `entity #${entityIndex} (${entity.type}) ends at ${end}, text length ${text.length}`,
                entityIndex,
            });
            return;
        }
        if (splitsSurrogatePair(text, entity.offset) || splitsSurrogatePair(text, end)) {
            issues.push({
                code: 'surrogate-misaligned',
                message: `entity #${entityIndex} (${entity.type}) boundary splits a surrogate pair`,
                entityIndex,
            });
        }
        if (entity.type === 'text_link' && !entity.url) {
            issues.push({
                code: 'missing-url',
                message: `entity #${entityIndex} is a text_link without url`,
                entityIndex,
            });
        }
        if (entity.url !== undefined && entity.type !== 'text_link') {
            issues.push({
                code: 'unexpected-field',
                message: `entity #${entityIndex} (${entity.type}) carries url`,
                entityIndex,
            });
        }
        if (entity.language !== undefined && entity.type !== 'pre') {
            issues.push({
                code: 'unexpected-field',
                message: `entity #${entityIndex} (${entity.type}) carries language`,
                entityIndex,
            });
        }
    });

    // Containment / nesting via stack scan over (offset asc, length desc)
    const order = entities
        .map((entity, entityIndex) => ({ entity, entityIndex }))
        .filter(({ entity }) => entity.length > 0)
        .sort((a, b) => compareEntities(a.entity, b.entity));

    const stack: Array<{ entity: MessageEntity; entityIndex: number }> = [];
    for (const item of order) {
        const { entity, entityIndex } = item;
        while (stack.length > 0) {
            const top = stack[stack.length - 1];
            if (top && top.entity.offset + top.entity.length <= entity.offset) {
                stack.pop();
            } else {
                break;
            }
        }

        const parent = stack[stack.length - 1];
        if (parent) {
            const parentEnd = parent.entity.offset + parent.entity.length;
            if (entity.offset + entity.length > parentEnd) {
                issues.push({
                    code: 'overlap-not-nested',
                    message: `entity #${entityIndex} (${entity.type}) partially overlaps #${parent.entityIndex} (${parent.entity.type})`,
                    entityIndex,
                });
            } else if (isOpaque(parent.entity.type)) {
                issues.push({
                    code: 'illegal-nesting',
                    message: `entity #${entityIndex} (${entity.type}) nested inside ${parent.entity.type}`,
                    entityIndex,
                });
            } else if (isQuote(entity.type)) {
                issues.push({
                    code: 'illegal-nesting',
                    message: `entity #${entityIndex} (${entity.type}) must be top-level, found inside ${parent.entity.type}`,
                    entityIndex,
                });
            }
        }

        stack.push(item);
    }

    return issues;
};
