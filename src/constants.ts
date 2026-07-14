/** Telegram's hard message text limit in UTF-16 code units */
export const DEFAULT_MAX_LENGTH = 4096;

/**
 * Default entity budget per chunk. Telegram silently drops entities past an
 * undocumented cap of exactly 100 (measured 2026-07-13 via the RUN_PROBE=1
 * e2e probe: 150 sent → 100 kept); 90 leaves headroom for server-side
 * splitting of nested entities.
 */
export const DEFAULT_MAX_ENTITIES = 90;

/** Default replacement text for markdown horizontal rules */
export const DEFAULT_HR_TEXT = '———';
