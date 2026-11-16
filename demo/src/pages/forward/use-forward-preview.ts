import { useEffect, useMemo, useState } from 'react';
import { hasQuote, markdownToRendered, renderedToPreviewHtml, withQuoteStyle } from '../../core/entity-convert';
import type { ClientPlatform, RenderedMarkdown } from '../../core/types';

/** Rendering 4 KB of markdown costs ~11 ms; typing must never wait for it */
const PREVIEW_DEBOUNCE_MS = 250;

const useDebouncedValue = <TValue>(value: TValue, delayMs: number): TValue => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

/**
 * What the receiving client keeps of the rendered message. iOS is the one
 * forward channel that is markdown text, and its paste parser has no spoiler
 * syntax: `||…||` arrives as plain text, so the preview must not show a
 * spoiler there.
 */
const withClientStyle = (rendered: RenderedMarkdown, platform: ClientPlatform): RenderedMarkdown => {
  if (platform !== 'ios') return rendered;
  return {
    text: rendered.text,
    entities: rendered.entities.filter((entity) => entity.type !== 'spoiler'),
  };
};

export type ForwardPreview =
  | { kind: 'empty' }
  | { kind: 'failed' }
  | { kind: 'ready'; rendered: RenderedMarkdown; previewHtml: string; hasQuote: boolean };

/**
 * Markdown -> entities + preview HTML, debounced so long input stays smooth.
 * The copy buttons convert the current value directly and never wait for this.
 */
export const useForwardPreview = (
  markdown: string,
  collapsedQuotes: boolean,
  platform: ClientPlatform
): ForwardPreview => {
  const debounced = useDebouncedValue(markdown, PREVIEW_DEBOUNCE_MS);
  return useMemo<ForwardPreview>(() => {
    if (debounced.trim() === '') return { kind: 'empty' };
    try {
      const base = markdownToRendered(debounced);
      // The toggle makes every quote collapsible; unchecked keeps the source
      // style, so a <details> block stays an expandable quote on its own
      const styled = collapsedQuotes ? withQuoteStyle(base, true) : base;
      const rendered = withClientStyle(styled, platform);
      return {
        kind: 'ready',
        rendered,
        previewHtml: renderedToPreviewHtml(rendered),
        hasQuote: hasQuote(base),
      };
    } catch {
      return { kind: 'failed' };
    }
  }, [debounced, collapsedQuotes, platform]);
};
