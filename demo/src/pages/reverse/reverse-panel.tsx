import { useMemo } from 'react';
import { match } from 'ts-pattern';
import type { ChannelPlan, ClientPlatform } from '../../core/types';
import { reverseNoteOf } from '../../lib/platform';
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
  const platformNote = useMemo(() => reverseNoteOf(platform), [platform]);
  const summary = useMemo(
    () => (state.kind === 'rich' ? parsedSummaryOf(state.conversion) : null),
    [state],
  );

  return (
    <div className="rv-panel">
      <section className="card rv-step">
        <StepHeading index={1} title="粘贴消息" hint="从 Telegram 复制一条带格式的消息" />
        <PasteZone onPaste={handlePaste} onReadClipboard={readFromClipboard} reading={reading} />
        {platformNote !== '' && <p className="hint rv-platform-note">{platformNote}</p>}
        {match(state)
          .with({ kind: 'idle' }, () => (
            <p className="notice info">在 Telegram 里复制一条带格式的消息，再粘贴到这里。</p>
          ))
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
          <StepHeading index={2} title="解析结果" hint="看看识别到了哪些格式" />
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
