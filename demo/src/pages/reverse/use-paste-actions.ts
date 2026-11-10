import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ClipboardEvent } from 'react';
import { clipboardHtmlToMarkdown } from '../../core/entity-convert';
import type { PasteState } from './reverse-types';

const EMPTY_MESSAGE = '剪贴板里没有可识别的文本内容。';
const READ_FAILED_MESSAGE = '读取剪贴板失败，请改用粘贴。';
const PARSE_FAILED_MESSAGE = '富文本解析失败，请尝试用纯文本粘贴。';

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
  const [state, setState] = useState<PasteState>({ kind: 'idle' });
  const [markdown, setMarkdown] = useState('');
  const [reading, setReading] = useState(false);

  const applyRich = useCallback((html: string) => {
    try {
      const conversion = clipboardHtmlToMarkdown(html);
      setState({ kind: 'rich', conversion });
      setMarkdown(conversion.markdown);
    } catch {
      setState({ kind: 'error', message: PARSE_FAILED_MESSAGE });
      setMarkdown('');
    }
  }, []);

  const applyPlain = useCallback((text: string) => {
    setState({ kind: 'plain', text });
    setMarkdown('');
  }, []);

  const applyEmpty = useCallback(() => {
    setState({ kind: 'error', message: EMPTY_MESSAGE });
    setMarkdown('');
  }, []);

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
          setState({ kind: 'error', message: READ_FAILED_MESSAGE });
          setMarkdown('');
        } finally {
          setReading(false);
        }
      })();
    };
  }, [readSupported, applyRich, applyPlain, applyEmpty]);

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
