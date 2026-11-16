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

/**
 * The toggle forces every quote collapsible. Unchecked leaves the source
 * styles alone: a `> quote` stays a normal quote and a `<details>` block stays
 * an expandable one.
 */
const withQuoteChoice = (rendered: RenderedMarkdown, collapsedQuotes: boolean): RenderedMarkdown =>
  collapsedQuotes ? withQuoteStyle(rendered, true) : rendered;

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
  // The plan carries the recommendation policy; macOS has none (the matrix
  // says no channel works there), so no badge is shown on that platform.
  const macosUnavailable = plan.platform === 'macos';
  const recommended = plan.recommended;

  const handleCopyRich = useCallback(() => {
    const rendered = renderOrNull(markdown);
    if (rendered === null) {
      reportFailure({ key: 'forward.convert.richFailed' });
      return;
    }
    const payload = renderedToClipboardPayload(withQuoteChoice(rendered, collapsedQuotes), plan.target);
    copyRich(payload.html, payload.plainText);
  }, [markdown, plan.target, collapsedQuotes, copyRich, reportFailure]);

  const handleCopyMarkdown = useCallback(() => {
    const rendered = renderOrNull(markdown);
    if (rendered === null) {
      reportFailure({ key: 'forward.convert.markdownFailed' });
      return;
    }
    const text =
      plan.markdownDialect === 'ios'
        ? renderedToIosMarkdown(rendered)
        : renderedToTelegramMarkdown(rendered);
    // One key per dialect: the line is translated again on a locale switch
    copyPlainText(text, {
      key:
        plan.markdownDialect === 'ios'
          ? 'forward.copy.markdown.done.ios'
          : 'forward.copy.markdown.done.telegram',
    });
  }, [markdown, plan.markdownDialect, copyPlainText, reportFailure]);

  const handleCopyPlain = useCallback(() => {
    const rendered = renderOrNull(markdown);
    if (rendered === null) {
      reportFailure({ key: 'forward.convert.plainFailed' });
      return;
    }
    copyPlainText(rendered.text, { key: 'forward.copy.plain.done' });
  }, [markdown, copyPlainText, reportFailure]);

  return useMemo<readonly ChannelAction[]>(
    () => [
      {
        id: 'rich-html',
        label: t('forward.copy.rich'),
        hint: macosUnavailable
          ? t('forward.copy.rich.hint.macos')
          : t('forward.copy.rich.hint'),
        recommended: recommended === 'rich-html',
        disabled: !hasContent,
        onSelect: handleCopyRich,
      },
      {
        id: 'markdown',
        label: t('forward.copy.markdown'),
        hint: macosUnavailable
          ? t('forward.copy.markdown.hint.macos')
          : t('forward.copy.markdown.hint', { dialect: dialectLabel }),
        recommended: recommended === 'markdown',
        disabled: !hasContent,
        onSelect: handleCopyMarkdown,
      },
      {
        id: 'plain',
        label: t('forward.copy.plain'),
        hint: t('forward.copy.plain.hint'),
        recommended: recommended === 'plain',
        disabled: !hasContent,
        onSelect: handleCopyPlain,
      },
    ],
    [
      hasContent,
      recommended,
      macosUnavailable,
      dialectLabel,
      handleCopyRich,
      handleCopyMarkdown,
      handleCopyPlain,
      t,
    ]
  );
};
