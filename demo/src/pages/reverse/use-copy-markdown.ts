import { useCallback, useEffect, useState } from 'react';
import { copyText } from '../../lib/clipboard';
import type { CopyStatus } from './reverse-types';

export interface CopyMarkdown {
  status: CopyStatus | null;
  copy: () => void;
}

/**
 * Copy the current markdown; the outcome line clears whenever the text changes.
 * It stores a message key, so switching the locale re-translates it instead of
 * leaving the old language on screen.
 */
export const useCopyMarkdown = (markdown: string): CopyMarkdown => {
  const [status, setStatus] = useState<CopyStatus | null>(null);

  useEffect(() => {
    setStatus(null);
  }, [markdown]);

  const copy = useCallback(() => {
    if (markdown === '') return;
    void copyText(markdown).then((ok) => {
      setStatus(
        ok
          ? { tone: 'success', messageKey: 'reverse.output.copied' }
          : { tone: 'error', messageKey: 'reverse.output.copyFailed' },
      );
    });
  }, [markdown]);

  return { status, copy };
};
