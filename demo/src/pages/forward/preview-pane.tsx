import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { DEFAULT_MAX_LENGTH } from 'telegram-md-entities';
import { match } from 'ts-pattern';
import { MESSAGE_ENTITY_LIMIT, MESSAGE_ENTITY_WARN_LIMIT } from '../../core/entity-convert';
import { useI18n } from '../../i18n/i18n-context';
import { PreviewBubble } from './preview-bubble';
import type { ForwardPreview } from './use-forward-preview';

interface PreviewPaneProps {
  preview: ForwardPreview;
  /** Every quote in the message is rendered as a collapsible quote */
  collapsedQuotes: boolean;
  onCollapsedQuotesChange: (value: boolean) => void;
}

interface PreviewMeta {
  label: string;
  /** The sent text is longer than one message and will be split */
  over: boolean;
  parts: number;
  /** Entities of the whole message: Telegram drops the excess silently */
  entities: number;
  entityRisk: boolean;
}

/**
 * Right column: how the message will look inside a Telegram client. The meta
 * line counts the rendered text (what Telegram actually receives), not the
 * markdown source, so a long link URL does not inflate it.
 */
export const PreviewPane = ({
  preview,
  collapsedQuotes,
  onCollapsedQuotesChange,
}: PreviewPaneProps) => {
  const { t } = useI18n();
  const handleQuoteToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onCollapsedQuotesChange(event.target.checked),
    [onCollapsedQuotesChange],
  );

  const meta = useMemo<PreviewMeta | null>(() => {
    if (preview.kind !== 'ready') return null;
    const textLength = preview.rendered.text.length;
    const entities = preview.rendered.entities.length;
    const entityRisk = entities >= MESSAGE_ENTITY_WARN_LIMIT;
    if (textLength > DEFAULT_MAX_LENGTH) {
      const parts = Math.ceil(textLength / DEFAULT_MAX_LENGTH);
      return {
        label: t('forward.preview.meta.split', { chars: textLength, parts }),
        over: true,
        parts,
        entities,
        entityRisk,
      };
    }
    return {
      label: t('forward.preview.meta', { chars: textLength, entities }),
      over: false,
      parts: 1,
      entities,
      entityRisk,
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
      {preview.kind === 'ready' && preview.hasQuote && (
        <label className="fw-quote-toggle">
          <input type="checkbox" checked={collapsedQuotes} onChange={handleQuoteToggle} />
          <span className="fw-quote-toggle-label">{t('forward.quote.label')}</span>
          <span className="hint">{t('forward.quote.hint')}</span>
        </label>
      )}
      {meta !== null && meta.over && (
        <p className="notice info">
          {t('forward.splitHint', { max: DEFAULT_MAX_LENGTH, parts: meta.parts })}
        </p>
      )}
      {meta !== null && meta.entityRisk && (
        <p className="notice warning">
          {t(meta.over ? 'forward.entityCap.split' : 'forward.entityCap', {
            entities: meta.entities,
            max: MESSAGE_ENTITY_LIMIT,
            parts: meta.parts,
          })}
        </p>
      )}
      <p className="hint">{t('forward.preview.note')}</p>
    </section>
  );
};
