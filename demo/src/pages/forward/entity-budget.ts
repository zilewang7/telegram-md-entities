/**
 * Entity budget of a message the client is about to send.
 *
 * A Telegram client splitting a pasted message counts characters only: it does
 * not know where the entity budget falls. So the split is estimated at the
 * character limit and each part's entities are counted there — an entity that
 * crosses a cut counts in both parts, because the client restarts the style on
 * each side. The estimate is what the warning under the preview is based on.
 */
import { DEFAULT_MAX_LENGTH } from 'telegram-md-entities';
import { MESSAGE_ENTITY_LIMIT, MESSAGE_ENTITY_WARN_LIMIT } from '../../core/entity-convert';
import type { RenderedMarkdown } from '../../core/types';

export interface EntityBudget {
  /** Messages the client will send */
  parts: number;
  /** Entities in the busiest part */
  maxEntitiesPerPart: number;
  /** At least one part is close to the per-message cap */
  risk: boolean;
  /** At least one part is past the cap and loses entities on send */
  over: boolean;
}

const partOf = (offset: number, parts: number): number =>
  Math.min(parts - 1, Math.max(0, Math.floor(offset / DEFAULT_MAX_LENGTH)));

export const entityBudgetOf = (rendered: RenderedMarkdown): EntityBudget => {
  const textLength = rendered.text.length;
  const parts = Math.max(1, Math.ceil(textLength / DEFAULT_MAX_LENGTH));
  if (parts === 1) {
    const entities = rendered.entities.length;
    return {
      parts,
      maxEntitiesPerPart: entities,
      risk: entities >= MESSAGE_ENTITY_WARN_LIMIT,
      over: entities > MESSAGE_ENTITY_LIMIT,
    };
  }

  const counts = Array.from({ length: parts }, () => 0);
  for (const entity of rendered.entities) {
    const firstPart = partOf(entity.offset, parts);
    // max(0, …) keeps a zero-length entity inside its own part
    const lastPart = partOf(entity.offset + Math.max(0, entity.length - 1), parts);
    for (let part = firstPart; part <= lastPart; part += 1) {
      counts[part] = (counts[part] ?? 0) + 1;
    }
  }

  const maxEntitiesPerPart = counts.reduce((max, count) => Math.max(max, count), 0);
  return {
    parts,
    maxEntitiesPerPart,
    risk: maxEntitiesPerPart >= MESSAGE_ENTITY_WARN_LIMIT,
    over: maxEntitiesPerPart > MESSAGE_ENTITY_LIMIT,
  };
};
