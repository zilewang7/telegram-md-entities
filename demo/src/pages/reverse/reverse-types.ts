/**
 * Shared state types of the reverse panel (Telegram -> markdown).
 */
import type { MessageKey } from '../../i18n/messages';
import type { ClipboardConversion } from '../../core/types';

/** What the last paste, clipboard read or typed text produced */
export type PasteState =
  | { kind: 'idle' }
  | { kind: 'rich'; conversion: ClipboardConversion }
  | { kind: 'plain'; text: string }
  /** Message key rather than a translated string: a locale switch re-translates it */
  | { kind: 'error'; messageKey: MessageKey };

/** Outcome line shown under the copy button */
export interface CopyStatus {
  tone: 'success' | 'error';
  messageKey: MessageKey;
}
