import { useCallback, useMemo, useState } from 'react';
import type { ChannelPlan } from '../../core/types';
import { useI18n } from '../../i18n/i18n-context';
import { channelNoteKeyOf } from '../../i18n/messages';
import { ChannelActions } from './channel-actions';
import { ChannelStatus } from './channel-status';
import { EntityJson } from './entity-json';
import { MarkdownEditor } from './markdown-editor';
import { PreviewPane } from './preview-pane';
import { useCopyActions } from './use-copy-actions';
import { useForwardActions } from './use-forward-actions';
import { useForwardPreview } from './use-forward-preview';
import './forward.css';

interface ForwardPanelProps {
  plan: ChannelPlan;
}

/** Direction 1: markdown -> Telegram entities, live preview and copy channels */
export const ForwardPanel = ({ plan }: ForwardPanelProps) => {
  const { t } = useI18n();
  // Seeded once on purpose: switching language keeps the text the user edited
  const [markdown, setMarkdown] = useState(() => t('forward.sample.content'));
  const preview = useForwardPreview(markdown);
  const copy = useCopyActions();
  const actions = useForwardActions({ markdown, plan, copy });
  const channelNote = useMemo(
    () => t(channelNoteKeyOf(plan.platform)),
    [plan.platform, t]
  );

  const handleChange = useCallback((next: string) => setMarkdown(next), []);
  const handleLoadSample = useCallback(() => setMarkdown(t('forward.sample.content')), [t]);
  const handleClear = useCallback(() => setMarkdown(''), []);

  return (
    <>
      <div className="split fw-split">
        <MarkdownEditor
          value={markdown}
          onChange={handleChange}
          onLoadSample={handleLoadSample}
          onClear={handleClear}
        />
        <PreviewPane preview={preview} />
      </div>

      <section className="section">
        <div className="fw-head">
          <h2 className="section-title">{t('forward.copy.title')}</h2>
          <span className="hint">{t('forward.copy.hint')}</span>
        </div>
        <ChannelActions actions={actions} />
        <ChannelStatus status={copy.status} />
      </section>

      {preview.kind === 'ready' && <EntityJson rendered={preview.rendered} />}

      <section className="section">
        <h2 className="section-title">{t('forward.channel.title')}</h2>
        <p className="notice info">{channelNote}</p>
      </section>
    </>
  );
};
