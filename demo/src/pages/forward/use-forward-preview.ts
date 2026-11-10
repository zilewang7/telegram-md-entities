import { useEffect, useMemo, useState } from 'react';
import { markdownToRendered, renderedToPreviewHtml } from '../../core/entity-convert';
import type { RenderedMarkdown } from '../../core/types';

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

export type ForwardPreview =
  | { kind: 'empty' }
  | { kind: 'failed' }
  | { kind: 'ready'; rendered: RenderedMarkdown; previewHtml: string };

/**
 * Markdown -> entities + preview HTML, debounced so long input stays smooth.
 * The copy buttons convert the current value directly and never wait for this.
 */
export const useForwardPreview = (markdown: string): ForwardPreview => {
  const debounced = useDebouncedValue(markdown, PREVIEW_DEBOUNCE_MS);
  return useMemo<ForwardPreview>(() => {
    if (debounced.trim() === '') return { kind: 'empty' };
    try {
      const rendered = markdownToRendered(debounced);
      return { kind: 'ready', rendered, previewHtml: renderedToPreviewHtml(rendered) };
    } catch {
      return { kind: 'failed' };
    }
  }, [debounced]);
};
