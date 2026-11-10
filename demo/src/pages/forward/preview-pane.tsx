import { useMemo } from 'react';
import { DEFAULT_MAX_LENGTH } from 'telegram-md-entities';
import { match } from 'ts-pattern';
import { useI18n } from '../../i18n/i18n-context';
import { PreviewBubble } from './preview-bubble';
import type { ForwardPreview } from './use-forward-preview';

interface PreviewPaneProps {
  preview: ForwardPreview;
}

interface PreviewMeta {
  label: string;
  over: boolean;
  parts: number;
}

/**
 * Right column: how the message will look inside a Telegram client. The meta
 * line counts the rendered text (what Telegram actually receives), not the
 * markdown source, so a long link URL does not inflate it.
 */
export const PreviewPane = ({ preview }: PreviewPaneProps) => {
  const { t } = useI18n();

  const meta = useMemo<PreviewMeta | null>(() => {
    if (preview.kind !== 'ready') return null;
    const textLength = preview.rendered.text.length;
    if (textLength > DEFAULT_MAX_LENGTH) {
      const parts = Math.ceil(textLength / DEFAULT_MAX_LENGTH);
      return {
        label: t('forward.preview.meta.split', { chars: textLength, parts }),
        over: true,
        parts,
      };
    }
    return {
      label: t('forward.preview.meta', {
        chars: textLength,
        entities: preview.rendered.entities.length,
      }),
      over: false,
      parts: 1,
    };
  }, [preview, t]);

  return (
    <section className="section">
      <div className="field-label-row">
        <h2 className="field-label">{t('forward.preview.title')}</h2>
        {meta !== null && (
          <span className={meta.over ? 'fw-preview-meta over' : 'fw-preview-meta'}>{meta.label}</span>
        )}
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
      {meta !== null && meta.over && (
        <p className="notice info">
          {t('forward.splitHint', { max: DEFAULT_MAX_LENGTH, parts: meta.parts })}
        </p>
      )}
      <p className="hint">{t('forward.preview.note')}</p>
    </section>
  );
};
