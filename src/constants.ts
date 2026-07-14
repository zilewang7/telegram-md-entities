/** Telegram's hard message text limit in UTF-16 code units */
export const DEFAULT_MAX_LENGTH = 4096;

/**
 * Default entity budget per chunk. Telegram silently drops entities past an
 * undocumented cap (~100 observed in the wild); 90 leaves headroom.
 * Provisional until the RUN_PROBE=1 e2e probe pins the real number.
 */
export const DEFAULT_MAX_ENTITIES = 90;

/** Default replacement text for markdown horizontal rules */
export const DEFAULT_HR_TEXT = '———';
