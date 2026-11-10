import { useCallback, useEffect, useState } from 'react';
import { copyText } from '../../lib/clipboard';
import type { CopyStatus } from './reverse-types';

const COPY_SUCCESS_MESSAGE = '已复制 Markdown，去粘贴吧';
const COPY_FAILED_MESSAGE = '复制失败，请手动全选文本复制';

export interface CopyMarkdown {
  status: CopyStatus | null;
  copy: () => void;
}

/** Copy the current markdown; the outcome line clears whenever the text changes */
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
          ? { tone: 'success', message: COPY_SUCCESS_MESSAGE }
          : { tone: 'error', message: COPY_FAILED_MESSAGE },
      );
    });
  }, [markdown]);

  return { status, copy };
};
