import { useMemo } from 'react';
import { match } from 'ts-pattern';
import { useI18n } from '../../i18n/i18n-context';
import { PreviewBubble } from './preview-bubble';
import type { ForwardPreview } from './use-forward-preview';

interface PreviewPaneProps {
  preview: ForwardPreview;
}

/** Right column: how the message will look inside a Telegram client */
export const PreviewPane = ({ preview }: PreviewPaneProps) => {
  const { t } = useI18n();
  const summary = useMemo(
    () =>
      match(preview)
        .with({ kind: 'ready' }, ({ rendered }) =>
          t('forward.preview.entities', { count: rendered.entities.length })
        )
        .otherwise(() => null),
    [preview, t]
  );

  return (
    <section className="section">
      <div className="field-label-row">
        <h2 className="field-label">{t('forward.preview.title')}</h2>
        {summary !== null && <span className="hint">{summary}</span>}
      </div>
      <div className="fw-stage">
        {match(preview)
          .with({ kind: 'empty' }, () => (
            <p className="hint fw-stage-empty">{t('forward.preview.empty')}</p>
          ))
          .with({ kind: 'failed' }, () => (
            <p className="error-text">{t('forward.preview.failed')}</p>
          ))
          .with({ kind: 'ready' }, ({ previewHtml }) => <PreviewBubble html={previewHtml} />)
          .exhaustive()}
      </div>
      <p className="hint">{t('forward.preview.note')}</p>
    </section>
  );
};
