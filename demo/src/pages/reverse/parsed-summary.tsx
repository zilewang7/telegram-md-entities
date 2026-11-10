import type { EntityType } from 'telegram-md-entities';
import type { ClipboardConversion } from '../../core/types';
import { useI18n } from '../../i18n/i18n-context';
import type { Locale, MessageKey, MessageVars } from '../../i18n/messages';

type Translate = (key: MessageKey, vars?: MessageVars) => string;

const ENTITY_LABEL_KEYS: Readonly<Record<EntityType, MessageKey>> = {
  bold: 'reverse.entity.bold',
  italic: 'reverse.entity.italic',
  underline: 'reverse.entity.underline',
  strikethrough: 'reverse.entity.strikethrough',
  spoiler: 'reverse.entity.spoiler',
  code: 'reverse.entity.code',
  pre: 'reverse.entity.pre',
  blockquote: 'reverse.entity.blockquote',
  expandable_blockquote: 'reverse.entity.expandable_blockquote',
  text_link: 'reverse.entity.text_link',
};

const SOURCE_LABEL_KEYS: Readonly<Record<ClipboardConversion['source'], MessageKey>> = {
  'webk-json': 'reverse.source.webk-json',
  html: 'reverse.source.html',
};

/** Tag lists follow the locale's punctuation (ideographic comma vs ASCII comma) */
const TAG_SEPARATORS: Readonly<Record<Locale, string>> = {
  zh: '\u3001',
  en: ', ',
};

export interface ParsedSummaryView {
  sourceLabel: string;
  characterCount: number;
  entityChips: readonly string[];
  ignoredTags: readonly string[];
}

/** Turn a reverse conversion into the short "what was parsed" summary */
export const parsedSummaryOf = (
  conversion: ClipboardConversion,
  t: Translate,
): ParsedSummaryView => {
  const counts = new Map<EntityType, number>();
  for (const entity of conversion.entities) {
    counts.set(entity.type, (counts.get(entity.type) ?? 0) + 1);
  }
  const entityChips = [...counts.entries()].map(
    ([type, count]) => `${t(ENTITY_LABEL_KEYS[type])} ×${count}`,
  );
  return {
    sourceLabel: t(SOURCE_LABEL_KEYS[conversion.source]),
    characterCount: conversion.text.length,
    entityChips,
    ignoredTags: conversion.ignoredTags,
  };
};

interface ParsedSummaryProps {
  summary: ParsedSummaryView;
}

/** What the parser recognised, and which tags it had to drop */
export const ParsedSummary = ({ summary }: ParsedSummaryProps) => {
  const { t, locale } = useI18n();

  return (
    <div className="rv-summary">
      <p className="rv-summary-meta">
        <span>
          {t('reverse.parsed.source', {
            source: summary.sourceLabel,
            chars: summary.characterCount,
          })}
        </span>
      </p>
      {summary.entityChips.length > 0 ? (
        <div className="chip-row">
          {summary.entityChips.map((chip) => (
            <span className="chip" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      ) : (
        <p className="hint">{t('reverse.parsed.none')}</p>
      )}
      {summary.ignoredTags.length > 0 && (
        <p className="hint">
          {t('reverse.parsed.ignored', { tags: summary.ignoredTags.join(TAG_SEPARATORS[locale]) })}
        </p>
      )}
    </div>
  );
};
