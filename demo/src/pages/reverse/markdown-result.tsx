import type { ChangeEvent } from 'react';
import { useI18n } from '../../i18n/i18n-context';
import type { CopyStatus } from './reverse-types';
import { StepHeading } from './step-heading';

interface MarkdownResultProps {
  markdown: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onCopy: () => void;
  status: CopyStatus | null;
}

/** Step 3: editable markdown plus the copy button and its outcome */
export const MarkdownResult = ({ markdown, onChange, onCopy, status }: MarkdownResultProps) => {
  const { t } = useI18n();

  return (
    <section className="card rv-step">
      <StepHeading
        index={3}
        title={t('reverse.output.title')}
        hint={t('reverse.output.subtitle')}
      />
      <div className="field-group">
        <div className="field-label-row">
          <label className="field-label" htmlFor="rv-markdown-output">
            {t('reverse.output.label')}
          </label>
          <span className="hint">{t('reverse.output.chars', { count: markdown.length })}</span>
        </div>
        <textarea
          id="rv-markdown-output"
          className="field rv-markdown-input"
          rows={9}
          spellCheck={false}
          value={markdown}
          onChange={onChange}
        />
      </div>
      <div className="rv-actions">
        <button type="button" className="button primary" onClick={onCopy}>
          {t('reverse.output.copy')}
        </button>
      </div>
      {status !== null && (
        <p className={status.tone === 'success' ? 'success-text' : 'error-text'} role="status">
          {status.message}
        </p>
      )}
    </section>
  );
};
