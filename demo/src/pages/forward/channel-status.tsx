import { useI18n } from '../../i18n/i18n-context';
import type { MessageKey, MessageVars } from '../../i18n/messages';

export type CopyTone = 'success' | 'error';

/** A status line kept as a message key, so switching the locale translates it */
export interface CopyMessage {
  key: MessageKey;
  vars?: MessageVars;
}

export interface CopyStatus {
  tone: CopyTone;
  message: CopyMessage;
}

interface ChannelStatusProps {
  status: CopyStatus | null;
}

/** Outcome of the last copy, translated when it is rendered */
export const ChannelStatus = ({ status }: ChannelStatusProps) => {
  const { t } = useI18n();
  if (status === null) return null;
  return (
    <p
      className={status.tone === 'error' ? 'error-text fw-status' : 'success-text fw-status'}
      role="status"
    >
      {t(status.message.key, status.message.vars)}
    </p>
  );
};
