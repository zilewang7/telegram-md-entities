import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/i18n-context';
import { copyText } from '../../lib/clipboard';
import type { CopyStatus } from './reverse-types';

export interface CopyMarkdown {
  status: CopyStatus | null;
  copy: () => void;
}

/** Copy the current markdown; the outcome line clears whenever the text changes */
export const useCopyMarkdown = (markdown: string): CopyMarkdown => {
  const { t } = useI18n();
  const [status, setStatus] = useState<CopyStatus | null>(null);

  useEffect(() => {
    setStatus(null);
  }, [markdown]);

  const copy = useCallback(() => {
    if (markdown === '') return;
    void copyText(markdown).then((ok) => {
      setStatus(
        ok
          ? { tone: 'success', message: t('reverse.output.copied') }
          : { tone: 'error', message: t('reverse.output.copyFailed') },
      );
    });
  }, [markdown, t]);

  return { status, copy };
};
