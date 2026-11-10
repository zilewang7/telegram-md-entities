import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ClipboardEvent } from 'react';
import { clipboardHtmlToMarkdown } from '../../core/entity-convert';
import { useI18n } from '../../i18n/i18n-context';
import type { PasteState } from './reverse-types';

export interface PasteActions {
  state: PasteState;
  /** Editable markdown, '' until a paste produced something */
  markdown: string;
  reading: boolean;
  handlePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** null when this browser cannot read the clipboard directly */
  readFromClipboard: (() => void) | null;
  handleUsePlainAsMarkdown: () => void;
  handleMarkdownChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

/**
 * Paste / clipboard-read state machine. Reads both clipboard flavors: HTML goes
 * through the rich parser, plain text becomes the fallback branch. Markdown
 * starts as the parsed output and stays editable afterwards.
 */
export const usePasteActions = (readSupported: boolean): PasteActions => {
  const { t } = useI18n();
  const [state, setState] = useState<PasteState>({ kind: 'idle' });
  const [markdown, setMarkdown] = useState('');
  const [reading, setReading] = useState(false);

  const applyRich = useCallback(
    (html: string) => {
      try {
        const conversion = clipboardHtmlToMarkdown(html);
        setState({ kind: 'rich', conversion });
        setMarkdown(conversion.markdown);
      } catch {
        setState({ kind: 'error', message: t('reverse.error.parseFailed') });
        setMarkdown('');
      }
    },
    [t],
  );

  const applyPlain = useCallback((text: string) => {
    setState({ kind: 'plain', text });
    setMarkdown('');
  }, []);

  const applyEmpty = useCallback(() => {
    setState({ kind: 'error', message: t('reverse.error.empty') });
    setMarkdown('');
  }, [t]);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      const data = event.clipboardData;
      const html = data.getData('text/html');
      const plain = data.getData('text/plain');
      // The textarea is only a paste target: never keep its content
      event.currentTarget.value = '';
      if (html.trim() !== '') {
        applyRich(html);
        return;
      }
      if (plain.trim() !== '') {
        applyPlain(plain);
        return;
      }
      applyEmpty();
    },
    [applyRich, applyPlain, applyEmpty],
  );

  const readFromClipboard = useMemo(() => {
    if (!readSupported) return null;
    return (): void => {
      setReading(true);
      void (async () => {
        try {
          const items = await navigator.clipboard.read();
          const item = items[0];
          if (item === undefined) {
            applyEmpty();
            return;
          }
          // Rich HTML first: it is the only flavor that keeps formatting
          if (item.types.includes('text/html')) {
            const html = await (await item.getType('text/html')).text();
            applyRich(html);
            return;
          }
          if (item.types.includes('text/plain')) {
            const text = await (await item.getType('text/plain')).text();
            applyPlain(text);
            return;
          }
          applyEmpty();
        } catch {
          setState({ kind: 'error', message: t('reverse.error.readFailed') });
          setMarkdown('');
        } finally {
          setReading(false);
        }
      })();
    };
  }, [readSupported, applyRich, applyPlain, applyEmpty, t]);

  const handleUsePlainAsMarkdown = useCallback(() => {
    if (state.kind !== 'plain') return;
    setMarkdown(state.text);
  }, [state]);

  const handleMarkdownChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setMarkdown(event.target.value),
    [],
  );

  return {
    state,
    markdown,
    reading,
    handlePaste,
    readFromClipboard,
    handleUsePlainAsMarkdown,
    handleMarkdownChange,
  };
};
