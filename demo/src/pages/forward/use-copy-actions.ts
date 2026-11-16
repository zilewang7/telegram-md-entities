import { useCallback, useState } from 'react';
import { match } from 'ts-pattern';
import { copyRichText, copyText } from '../../lib/clipboard';
import type { CopyRichResult } from '../../lib/clipboard';
import type { CopyMessage, CopyStatus } from './channel-status';

const successStatus = (message: CopyMessage): CopyStatus => ({ tone: 'success', message });

const errorStatus = (message: CopyMessage): CopyStatus => ({ tone: 'error', message });

/** What to tell the user about the channel that actually carried the HTML */
const richStatusOf = (result: CopyRichResult): CopyStatus =>
  match(result.channel)
    .with('clipboard-item', () => successStatus({ key: 'forward.copy.rich.ok' }))
    .with('copy-event', () => successStatus({ key: 'forward.copy.rich.okCompat' }))
    .with('plain-text', () => successStatus({ key: 'forward.copy.rich.fallback' }))
    .with('failed', () => errorStatus({ key: 'forward.copy.failed' }))
    .exhaustive();

export interface CopyActions {
  status: CopyStatus | null;
  copyRich: (html: string, plainText: string) => void;
  copyPlainText: (text: string, message: CopyMessage) => void;
  reportFailure: (message: CopyMessage) => void;
  /** Drop the outcome of an earlier copy once the content it described changed */
  clearStatus: () => void;
}

/**
 * Clipboard actions plus the outcome line the panel shows under its buttons.
 * The line is stored as message keys: a locale switch re-renders it in the new
 * language instead of leaving a stale translation on screen.
 */
export const useCopyActions = (): CopyActions => {
  const [status, setStatus] = useState<CopyStatus | null>(null);

  const copyRich = useCallback((html: string, plainText: string) => {
    void copyRichText(html, plainText).then((result) => setStatus(richStatusOf(result)));
  }, []);

  const copyPlainText = useCallback((text: string, message: CopyMessage) => {
    void copyText(text).then((ok) =>
      setStatus(ok ? successStatus(message) : errorStatus({ key: 'forward.copy.failed' }))
    );
  }, []);

  const reportFailure = useCallback(
    (message: CopyMessage) => setStatus(errorStatus(message)),
    []
  );

  const clearStatus = useCallback(() => setStatus(null), []);

  return { status, copyRich, copyPlainText, reportFailure, clearStatus };
};
