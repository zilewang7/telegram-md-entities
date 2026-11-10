import type { CopyChannel } from '../../lib/clipboard';

export type CopyTone = 'success' | 'error';

export interface CopyStatus {
  tone: CopyTone;
  /** The clipboard channel that actually carried the content */
  channel: CopyChannel;
  message: string;
}

interface ChannelStatusProps {
  status: CopyStatus | null;
}

/** Outcome of the last copy: what the user got, and through which channel */
export const ChannelStatus = ({ status }: ChannelStatusProps) => {
  if (status === null) return null;
  return (
    <p
      className={status.tone === 'error' ? 'error-text fw-status' : 'success-text fw-status'}
      role="status"
    >
      <span>{status.message}</span>
      <code className="fw-status-channel">{status.channel}</code>
    </p>
  );
};
