import type { ClientPlatform } from '../core/types';

export interface ClipboardCapabilities {
  /** The page can put text/html on the clipboard (async ClipboardItem + write) */
  htmlSupported: boolean;
  /** Paste events carry the clipboard flavors (the reverse input path) */
  pasteSupported: boolean;
  /** navigator.clipboard.read() exists; the browser may still ask for permission */
  readSupported: boolean;
}

/** Probe once per mount; capability flags never change at runtime */
export const detectClipboardCapabilities = (): ClipboardCapabilities => ({
  htmlSupported:
    typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function',
  pasteSupported: 'onpaste' in window,
  readSupported: typeof navigator.clipboard?.read === 'function',
});

/**
 * Best guess at the Telegram client the user will paste into. Desktop browsers
 * are assumed to pair with Telegram Desktop (the common case); phones are exact.
 * The picker lets the user override either way.
 */
export const detectClientPlatform = (userAgent: string = navigator.userAgent): ClientPlatform => {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  return 'tdesktop';
};

/** Selectable clients, in picker order; labels live in the message catalogue */
export const PLATFORM_OPTIONS: readonly ClientPlatform[] = [
  'tdesktop',
  'android',
  'ios',
  'macos',
  'web',
];
