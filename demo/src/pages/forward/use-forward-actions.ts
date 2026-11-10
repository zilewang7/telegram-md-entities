import { useCallback, useMemo } from 'react';
import { match } from 'ts-pattern';
import { markdownToRendered, renderedToClipboardPayload } from '../../core/entity-convert';
import { renderedToIosMarkdown, renderedToTelegramMarkdown } from '../../core/telegram-markdown';
import type { ChannelPlan, MarkdownDialect, RenderedMarkdown } from '../../core/types';
import type { ChannelAction } from './channel-actions';
import type { CopyActions } from './use-copy-actions';

const dialectLabelOf = (dialect: MarkdownDialect): string =>
  match(dialect)
    .with('ios', () => 'iOS 方言')
    .with('telegram', () => 'Telegram 方言')
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
}

/** The three copy buttons, wired to the current markdown and the platform plan */
export const useForwardActions = ({
  markdown,
  plan,
  copy,
}: ForwardActionsOptions): readonly ChannelAction[] => {
  const { copyRich, copyPlainText, reportFailure } = copy;
  const hasContent = markdown.trim() !== '';
  const dialectLabel = dialectLabelOf(plan.markdownDialect);

  const handleCopyRich = useCallback(() => {
    const rendered = renderOrNull(markdown);
    if (rendered === null) {
      reportFailure('转换失败：这段 Markdown 无法生成富文本。');
      return;
    }
    const payload = renderedToClipboardPayload(rendered, plan.target);
    copyRich(payload.html, payload.plainText);
  }, [markdown, plan.target, copyRich, reportFailure]);

  const handleCopyMarkdown = useCallback(() => {
    const rendered = renderOrNull(markdown);
    if (rendered === null) {
      reportFailure('转换失败：这段 Markdown 无法生成 Markdown 文本。');
      return;
    }
    const text =
      plan.markdownDialect === 'ios'
        ? renderedToIosMarkdown(rendered)
        : renderedToTelegramMarkdown(rendered);
    copyPlainText(text, `已复制 Markdown 文本（${dialectLabel}）`);
  }, [markdown, plan.markdownDialect, dialectLabel, copyPlainText, reportFailure]);

  const handleCopyPlain = useCallback(() => {
    const rendered = renderOrNull(markdown);
    if (rendered === null) {
      reportFailure('转换失败：这段 Markdown 无法生成纯文本。');
      return;
    }
    copyPlainText(rendered.text, '已复制纯文本');
  }, [markdown, copyPlainText, reportFailure]);

  return useMemo<readonly ChannelAction[]>(
    () => [
      {
        id: 'rich-html',
        label: '复制富文本',
        hint: '到 Telegram 输入框粘贴，格式会保留',
        recommended: plan.recommended === 'rich-html',
        disabled: !hasContent,
        onSelect: handleCopyRich,
      },
      {
        id: 'markdown',
        label: '复制 Markdown 文本',
        hint: `粘贴后由客户端按 ${dialectLabel} 转换`,
        recommended: plan.recommended === 'markdown',
        disabled: !hasContent,
        onSelect: handleCopyMarkdown,
      },
      {
        id: 'plain',
        label: '复制纯文本',
        hint: '不带格式，最保险的兜底',
        recommended: plan.recommended === 'plain',
        disabled: !hasContent,
        onSelect: handleCopyPlain,
      },
    ],
    [hasContent, plan.recommended, dialectLabel, handleCopyRich, handleCopyMarkdown, handleCopyPlain]
  );
};
