/**
 * Shared state types of the reverse panel (Telegram -> markdown).
 */
import type { ClipboardConversion } from '../../core/types';

/** What the last paste or clipboard read produced */
export type PasteState =
  | { kind: 'idle' }
  | { kind: 'rich'; conversion: ClipboardConversion }
  | { kind: 'plain'; text: string }
  | { kind: 'error'; message: string };

/** Outcome line shown under the copy button */
export interface CopyStatus {
  tone: 'success' | 'error';
  message: string;
}
