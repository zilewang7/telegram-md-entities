import { useCallback, useState } from 'react';
import { match } from 'ts-pattern';
import { copyRichText, copyText } from '../../lib/clipboard';
import type { CopyChannel, CopyRichResult } from '../../lib/clipboard';
import type { CopyStatus } from './channel-status';

const COPY_FAILED_MESSAGE = '复制失败：请手动全选文本复制';

const successStatus = (channel: CopyChannel, message: string): CopyStatus => ({
  tone: 'success',
  channel,
  message,
});

const errorStatus = (message: string): CopyStatus => ({ tone: 'error', channel: 'failed', message });

/** What to tell the user about the channel that actually carried the HTML */
const richStatusOf = (result: CopyRichResult): CopyStatus =>
  match(result.channel)
    .with('clipboard-item', () =>
      successStatus('clipboard-item', '已复制富文本，到 Telegram 输入框粘贴即可')
    )
    .with('copy-event', () =>
      successStatus('copy-event', '已复制富文本（兼容模式），到 Telegram 输入框粘贴即可')
    )
    .with('plain-text', () =>
      successStatus('plain-text', '当前浏览器不支持富文本剪贴板，已复制纯文本')
    )
    .with('failed', () => errorStatus(COPY_FAILED_MESSAGE))
    .exhaustive();

export interface CopyActions {
  status: CopyStatus | null;
  copyRich: (html: string, plainText: string) => void;
  /** successMessage is shown verbatim once the text is on the clipboard */
  copyPlainText: (text: string, successMessage: string) => void;
  reportFailure: (message: string) => void;
}

/** Clipboard actions plus the outcome line the panel shows under its buttons */
export const useCopyActions = (): CopyActions => {
  const [status, setStatus] = useState<CopyStatus | null>(null);

  const copyRich = useCallback((html: string, plainText: string) => {
    void copyRichText(html, plainText).then((result) => setStatus(richStatusOf(result)));
  }, []);

  const copyPlainText = useCallback((text: string, successMessage: string) => {
    void copyText(text).then((ok) =>
      setStatus(ok ? successStatus('plain-text', successMessage) : errorStatus(COPY_FAILED_MESSAGE))
    );
  }, []);

  const reportFailure = useCallback((message: string) => setStatus(errorStatus(message)), []);

  return { status, copyRich, copyPlainText, reportFailure };
};
