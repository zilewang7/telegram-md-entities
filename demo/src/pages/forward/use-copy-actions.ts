import { useCallback, useState } from 'react';
import { match } from 'ts-pattern';
import { useI18n } from '../../i18n/i18n-context';
import type { I18nValue } from '../../i18n/i18n-context';
import { copyRichText, copyText } from '../../lib/clipboard';
import type { CopyChannel, CopyRichResult } from '../../lib/clipboard';
import type { CopyStatus } from './channel-status';

type Translate = I18nValue['t'];

const successStatus = (channel: CopyChannel, message: string): CopyStatus => ({
  tone: 'success',
  channel,
  message,
});

const errorStatus = (message: string): CopyStatus => ({ tone: 'error', channel: 'failed', message });

/** What to tell the user about the channel that actually carried the HTML */
const richStatusOf = (result: CopyRichResult, t: Translate): CopyStatus =>
  match(result.channel)
    .with('clipboard-item', () => successStatus('clipboard-item', t('forward.copy.rich.ok')))
    .with('copy-event', () => successStatus('copy-event', t('forward.copy.rich.okCompat')))
    .with('plain-text', () => successStatus('plain-text', t('forward.copy.rich.fallback')))
    .with('failed', () => errorStatus(t('forward.copy.failed')))
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
  const { t } = useI18n();
  const [status, setStatus] = useState<CopyStatus | null>(null);

  const copyRich = useCallback(
    (html: string, plainText: string) => {
      void copyRichText(html, plainText).then((result) => setStatus(richStatusOf(result, t)));
    },
    [t]
  );

  const copyPlainText = useCallback(
    (text: string, successMessage: string) => {
      void copyText(text).then((ok) =>
        setStatus(
          ok ? successStatus('plain-text', successMessage) : errorStatus(t('forward.copy.failed'))
        )
      );
    },
    [t]
  );

  const reportFailure = useCallback((message: string) => setStatus(errorStatus(message)), []);

  return { status, copyRich, copyPlainText, reportFailure };
};
