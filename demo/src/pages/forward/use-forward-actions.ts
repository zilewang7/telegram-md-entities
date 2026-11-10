import { useCallback, useMemo } from 'react';
import { match } from 'ts-pattern';
import { markdownToRendered, renderedToClipboardPayload, withQuoteStyle } from '../../core/entity-convert';
import { renderedToIosMarkdown, renderedToTelegramMarkdown } from '../../core/telegram-markdown';
import type { ChannelPlan, MarkdownDialect, RenderedMarkdown } from '../../core/types';
import { useI18n } from '../../i18n/i18n-context';
import type { I18nValue } from '../../i18n/i18n-context';
import type { ChannelAction } from './channel-actions';
import type { CopyActions } from './use-copy-actions';

type Translate = I18nValue['t'];

const dialectLabelOf = (dialect: MarkdownDialect, t: Translate): string =>
  match(dialect)
    .with('ios', () => t('forward.dialect.ios'))
    .with('telegram', () => t('forward.dialect.telegram'))
    .exhaustive();

/** Convert once per action; a throw means this markdown cannot be converted */
const renderOrNull = (markdown: string): RenderedMarkdown | null => {
  try {
    return markdownToRendered(markdown);
  } catch {
    return null;
  }
};

interface ForwardActionsOptions {
  markdown: string;
  plan: ChannelPlan;
  copy: CopyActions;
  /** Every quote in the message becomes collapsible */
  collapsedQuotes: boolean;
}

/** The three copy buttons, wired to the current markdown and the platform plan */
export const useForwardActions = ({
  markdown,
  plan,
  copy,
  collapsedQuotes,
}: ForwardActionsOptions): readonly ChannelAction[] => {
  const { t } = useI18n();
  const { copyRich, copyPlainText, reportFailure } = copy;
  const hasContent = markdown.trim() !== '';
  const dialectLabel = useMemo(
    () => dialectLabelOf(plan.markdownDialect, t),
    [plan.markdownDialect, t]
  );

  const handleCopyRich = useCallback(() => {
    const rendered = renderOrNull(markdown);
    if (rendered === null) {
      reportFailure(t('forward.convert.richFailed'));
      return;
    }
    const payload = renderedToClipboardPayload(withQuoteStyle(rendered, collapsedQuotes), plan.target);
    copyRich(payload.html, payload.plainText);
  }, [markdown, plan.target, collapsedQuotes, copyRich, reportFailure, t]);

  const handleCopyMarkdown = useCallback(() => {
    const rendered = renderOrNull(markdown);
    if (rendered === null) {
      reportFailure(t('forward.convert.markdownFailed'));
      return;
    }
    const text =
      plan.markdownDialect === 'ios'
        ? renderedToIosMarkdown(rendered)
        : renderedToTelegramMarkdown(rendered);
    // The success line carries the dialect, so the caller composes the full message
    copyPlainText(text, t('forward.copy.markdown.done', { dialect: dialectLabel }));
  }, [markdown, plan.markdownDialect, dialectLabel, copyPlainText, reportFailure, t]);

  const handleCopyPlain = useCallback(() => {
    const rendered = renderOrNull(markdown);
    if (rendered === null) {
      reportFailure(t('forward.convert.plainFailed'));
      return;
    }
    copyPlainText(rendered.text, t('forward.copy.plain.done'));
  }, [markdown, copyPlainText, reportFailure, t]);

  return useMemo<readonly ChannelAction[]>(
    () => [
      {
        id: 'rich-html',
        label: t('forward.copy.rich'),
        hint: t('forward.copy.rich.hint'),
        recommended: plan.recommended === 'rich-html',
        disabled: !hasContent,
        onSelect: handleCopyRich,
      },
      {
        id: 'markdown',
        label: t('forward.copy.markdown'),
        hint: t('forward.copy.markdown.hint', { dialect: dialectLabel }),
        recommended: plan.recommended === 'markdown',
        disabled: !hasContent,
        onSelect: handleCopyMarkdown,
      },
      {
        id: 'plain',
        label: t('forward.copy.plain'),
        hint: t('forward.copy.plain.hint'),
        recommended: plan.recommended === 'plain',
        disabled: !hasContent,
        onSelect: handleCopyPlain,
      },
    ],
    [
      hasContent,
      plan.recommended,
      dialectLabel,
      handleCopyRich,
      handleCopyMarkdown,
      handleCopyPlain,
      t,
    ]
  );
};
