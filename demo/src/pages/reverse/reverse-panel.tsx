import { useMemo } from 'react';
import { match } from 'ts-pattern';
import type { ChannelPlan, ClientPlatform } from '../../core/types';
import { useI18n } from '../../i18n/i18n-context';
import { reverseNoteKeyOf } from '../../i18n/messages';
import { MarkdownResult } from './markdown-result';
import { ParsedSummary, parsedSummaryOf } from './parsed-summary';
import { PasteZone } from './paste-zone';
import { PlainFallback } from './plain-fallback';
import { StepHeading } from './step-heading';
import { useCopyMarkdown } from './use-copy-markdown';
import { usePasteActions } from './use-paste-actions';
import './reverse.css';

interface ReversePanelProps {
  /** Forward-direction plan; the reverse panel does not depend on it */
  plan: ChannelPlan;
  platform: ClientPlatform;
  /** navigator.clipboard.read() exists; the host may still refuse it */
  readSupported: boolean;
}

/** Direction 2: a Telegram message pasted from the clipboard -> markdown */
export const ReversePanel = ({ platform, readSupported }: ReversePanelProps) => {
  const { t } = useI18n();
  const {
    state,
    markdown,
    reading,
    handlePaste,
    readFromClipboard,
    handleUsePlainAsMarkdown,
    handleMarkdownChange,
  } = usePasteActions(readSupported);
  const { status, copy } = useCopyMarkdown(markdown);
  const platformNote = useMemo(() => t(reverseNoteKeyOf(platform)), [platform, t]);
  const summary = useMemo(
    () => (state.kind === 'rich' ? parsedSummaryOf(state.conversion, t) : null),
    [state, t],
  );

  return (
    <div className="rv-panel">
      <section className="card rv-step">
        <StepHeading
          index={1}
          title={t('reverse.paste.title')}
          hint={t('reverse.paste.subtitle')}
        />
        <PasteZone onPaste={handlePaste} onReadClipboard={readFromClipboard} reading={reading} />
        {platformNote !== '' && <p className="hint rv-platform-note">{platformNote}</p>}
        {match(state)
          .with({ kind: 'idle' }, () => <p className="notice info">{t('reverse.empty')}</p>)
          .with({ kind: 'error' }, ({ message }) => (
            <p className="error-text" role="alert">
              {message}
            </p>
          ))
          .with({ kind: 'plain' }, () => null)
          .with({ kind: 'rich' }, () => null)
          .exhaustive()}
      </section>

      {summary !== null && (
        <section className="card rv-step">
          <StepHeading
            index={2}
            title={t('reverse.parsed.title')}
            hint={t('reverse.parsed.subtitle')}
          />
          <ParsedSummary summary={summary} />
        </section>
      )}

      {state.kind === 'plain' && (
        <PlainFallback
          text={state.text}
          showAction={markdown === ''}
          onUseAsMarkdown={handleUsePlainAsMarkdown}
        />
      )}

      {markdown !== '' && (
        <MarkdownResult
          markdown={markdown}
          onChange={handleMarkdownChange}
          onCopy={copy}
          status={status}
        />
      )}
    </div>
  );
};
