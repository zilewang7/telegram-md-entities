/**
 * Containment tree over a (valid) entity list. Shared by the HTML preview
 * renderer; entities are assumed nested-or-disjoint (validateMessage form).
 */
import type { MessageEntity } from '../types';
import { compareEntities } from '../render/normalize-entities';

export interface EntityNode {
    entity: MessageEntity;
    children: EntityNode[];
}

export const buildEntityTree = (entities: MessageEntity[]): EntityNode[] => {
    const sorted = [...entities]
        .filter((entity) => entity.length > 0)
        .sort(compareEntities);

    const roots: EntityNode[] = [];
    const stack: EntityNode[] = [];

    for (const entity of sorted) {
        const node: EntityNode = { entity, children: [] };

        while (stack.length > 0) {
            const top = stack[stack.length - 1];
            if (top && top.entity.offset + top.entity.length <= entity.offset) {
                stack.pop();
            } else {
                break;
            }
        }

        const parent = stack[stack.length - 1];
        if (
            parent &&
            entity.offset >= parent.entity.offset &&
            entity.offset + entity.length <= parent.entity.offset + parent.entity.length
        ) {
            parent.children.push(node);
        } else {
            roots.push(node);
        }
        stack.push(node);
    }

    return roots;
};
