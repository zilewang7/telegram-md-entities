import type { RichChannel } from '../../core/types';

export interface ChannelAction {
  /** Which copy channel this button uses */
  id: RichChannel;
  label: string;
  /** One line under the button saying what the clipboard will carry */
  hint: string;
  recommended: boolean;
  disabled: boolean;
  onSelect: () => void;
}

interface ChannelActionsProps {
  actions: readonly ChannelAction[];
}

/** The three copy buttons; the channel this platform recommends is highlighted */
export const ChannelActions = ({ actions }: ChannelActionsProps) => (
  <div className="fw-actions">
    {actions.map((action) => (
      <div className="fw-action" key={action.id}>
        <button
          type="button"
          className={
            action.recommended ? 'button primary fw-action-button' : 'button secondary fw-action-button'
          }
          disabled={action.disabled}
          onClick={action.onSelect}
        >
          <span>{action.label}</span>
          {action.recommended && <span className="fw-badge">推荐</span>}
        </button>
        <p className="hint fw-action-hint">{action.hint}</p>
      </div>
    ))}
  </div>
);
