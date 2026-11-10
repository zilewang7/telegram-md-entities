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

export interface PlatformOption {
  value: ClientPlatform;
  label: string;
}

export const PLATFORM_OPTIONS: readonly PlatformOption[] = [
  { value: 'tdesktop', label: 'Desktop' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'macos', label: 'macOS' },
  { value: 'web', label: '网页版' },
];

export const PLATFORM_LABELS: Readonly<Record<ClientPlatform, string>> = {
  tdesktop: 'Telegram Desktop',
  android: 'Android',
  ios: 'iOS',
  macos: 'macOS 原生',
  web: 'Telegram 网页版',
  unknown: '未知客户端',
};

/** Direction 2 (Telegram -> markdown): what the source client actually copies */
export const reverseNoteOf = (platform: ClientPlatform): string => {
  switch (platform) {
    case 'tdesktop':
      return 'Desktop 复制消息时会写入 HTML，粘贴到这里即可还原格式。代码块的语言名在导出时丢失，属正常。';
    case 'android':
      return 'Android 复制消息时会写入 HTML，粘贴到这里即可还原。注意 Android 不认行内代码，那部分会变成普通文字。';
    case 'web':
      return 'Telegram 网页版复制消息时会写入 HTML（WebK 还会带上精确实体 JSON），粘贴到这里即可还原。';
    case 'ios':
      return 'iOS 复制消息时不写 HTML，只能拿到纯文本 —— 这是客户端限制，不是本工具的问题。';
    case 'macos':
      return 'macOS 原生客户端复制消息时不写 HTML，只能拿到纯文本 —— 这是客户端限制，不是本工具的问题。';
    default:
      return '';
  }
};
