import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ClipboardEvent } from 'react';
import { clipboardHtmlToMarkdown, escapePlainMarkdown } from '../../core/entity-convert';
import type { PasteState } from './reverse-types';

export interface PasteActions {
  state: PasteState;
  /** What the paste textarea currently shows */
  inputText: string;
  /** Editable markdown, '' until a paste (or the plain fallback) produced something */
  markdown: string;
  reading: boolean;
  handlePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** Typed text counts as plain input: it has no clipboard flavors to parse */
  handleInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** null when this browser cannot read the clipboard directly */
  readFromClipboard: (() => void) | null;
  handleUsePlainAsMarkdown: () => void;
  handleMarkdownChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

/**
 * Paste / clipboard-read state machine. Reads both clipboard flavors: HTML goes
 * through the rich parser, plain text becomes the fallback branch. Text typed
 * into the box takes the same plain branch, so the result below always matches
 * what the box shows. Markdown starts as the parsed output and stays editable.
 */
export const usePasteActions = (readSupported: boolean): PasteActions => {
  const [state, setState] = useState<PasteState>({ kind: 'idle' });
  const [inputText, setInputText] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [reading, setReading] = useState(false);

  const applyRich = useCallback((html: string) => {
    try {
      const conversion = clipboardHtmlToMarkdown(html);
      setInputText('');
      setState({ kind: 'rich', conversion });
      setMarkdown(conversion.markdown);
    } catch {
      setInputText('');
      setState({ kind: 'error', messageKey: 'reverse.error.parseFailed' });
      setMarkdown('');
    }
  }, []);

  const applyPlain = useCallback((text: string) => {
    setInputText('');
    setState({ kind: 'plain', text });
    setMarkdown('');
  }, []);

  const applyEmpty = useCallback(() => {
    setInputText('');
    setState({ kind: 'error', messageKey: 'reverse.error.empty' });
    setMarkdown('');
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      const data = event.clipboardData;
      const html = data.getData('text/html');
      const plain = data.getData('text/plain');
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

  const handleInputChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setInputText(text);
    setMarkdown('');
    setState(text.trim() === '' ? { kind: 'idle' } : { kind: 'plain', text });
  }, []);

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
          setInputText('');
          setState({ kind: 'error', messageKey: 'reverse.error.readFailed' });
          setMarkdown('');
        } finally {
          setReading(false);
        }
      })();
    };
  }, [readSupported, applyRich, applyPlain, applyEmpty]);

  const handleUsePlainAsMarkdown = useCallback(() => {
    if (state.kind !== 'plain') return;
    // Literal text, not source to reinterpret: `**` was two asterisks
    setMarkdown(escapePlainMarkdown(state.text));
  }, [state]);

  const handleMarkdownChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setMarkdown(event.target.value),
    [],
  );

  return {
    state,
    inputText,
    markdown,
    reading,
    handlePaste,
    handleInputChange,
    readFromClipboard,
    handleUsePlainAsMarkdown,
    handleMarkdownChange,
  };
};
