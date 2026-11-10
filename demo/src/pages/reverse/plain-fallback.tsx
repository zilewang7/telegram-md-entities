import { useI18n } from '../../i18n/i18n-context';
import { StepHeading } from './step-heading';

interface PlainFallbackProps {
  text: string;
  /** False once the plain text was already turned into markdown */
  showAction: boolean;
  onUseAsMarkdown: () => void;
}

/** Clipboard carried no HTML: explain the client limitation and offer the plain path */
export const PlainFallback = ({ text, showAction, onUseAsMarkdown }: PlainFallbackProps) => {
  const { t } = useI18n();

  return (
    <section className="card rv-step">
      <StepHeading index={2} title={t('reverse.plain.title')} hint={t('reverse.plain.subtitle')} />
      <p className="notice warning">{t('reverse.plain.warning')}</p>
      <div className="field-group">
        <span className="field-label">{t('reverse.plain.clipboardLabel')}</span>
        <pre className="code-block rv-plain-text">{text}</pre>
      </div>
      {showAction ? (
        <div className="rv-actions">
          <button type="button" className="button secondary" onClick={onUseAsMarkdown}>
            {t('reverse.plain.useAsMarkdown')}
          </button>
        </div>
      ) : (
        <p className="hint">{t('reverse.plain.applied')}</p>
      )}
    </section>
  );
};
