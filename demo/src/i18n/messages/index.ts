/**
 * Message catalogue: `zh` is the source of truth for keys, `en` must cover
 * exactly the same set (enforced by Record<MessageKey, string>).
 */
import type { ClientPlatform } from '../../core/types';
import { aboutEn, aboutZh } from './about';
import { commonEn, commonZh } from './common';
import { forwardEn, forwardZh } from './forward';
import { reverseEn, reverseZh } from './reverse';

export type Locale = 'zh' | 'en';

export const LOCALES: readonly Locale[] = ['zh', 'en'];

export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
  zh: '中文',
  en: 'English',
};

export const zhMessages = { ...commonZh, ...forwardZh, ...reverseZh, ...aboutZh };

export type MessageKey = keyof typeof zhMessages;

export const enMessages: Record<MessageKey, string> = {
  ...commonEn,
  ...forwardEn,
  ...reverseEn,
  ...aboutEn,
};

export type MessageVars = Readonly<Record<string, string | number>>;

const messagesOf = (locale: Locale): Record<MessageKey, string> =>
  locale === 'zh' ? zhMessages : enMessages;

/** `{name}` placeholders are substituted; unknown placeholders stay literal */
const interpolate = (template: string, vars: MessageVars | undefined): string => {
  if (vars === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
};

export const translate = (locale: Locale, key: MessageKey, vars?: MessageVars): string =>
  interpolate(messagesOf(locale)[key], vars);

export const PLATFORM_LABEL_KEYS: Readonly<Record<ClientPlatform, MessageKey>> = {
  tdesktop: 'platform.tdesktop',
  android: 'platform.android',
  ios: 'platform.ios',
  macos: 'platform.macos',
  web: 'platform.web',
  unknown: 'platform.tdesktop',
};

const CHANNEL_NOTE_KEYS: Readonly<Record<ClientPlatform, MessageKey>> = {
  tdesktop: 'channel.note.tdesktop',
  android: 'channel.note.android',
  ios: 'channel.note.ios',
  macos: 'channel.note.macos',
  web: 'channel.note.web',
  unknown: 'channel.note.unknown',
};

const REVERSE_NOTE_KEYS: Readonly<Record<ClientPlatform, MessageKey>> = {
  tdesktop: 'reverse.note.tdesktop',
  android: 'reverse.note.android',
  ios: 'reverse.note.ios',
  macos: 'reverse.note.macos',
  web: 'reverse.note.web',
  unknown: 'reverse.note.unknown',
};

/** The forward channel explanation for a target client */
export const channelNoteKeyOf = (platform: ClientPlatform): MessageKey => CHANNEL_NOTE_KEYS[platform];

/** The reverse direction explanation for a source client */
export const reverseNoteKeyOf = (platform: ClientPlatform): MessageKey => REVERSE_NOTE_KEYS[platform];
