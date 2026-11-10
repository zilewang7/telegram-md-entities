import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { DEFAULT_MAX_LENGTH } from 'telegram-md-entities';
import { useI18n } from '../../i18n/i18n-context';
import type { MessageKey } from '../../i18n/messages';

interface SyntaxChip {
  /** The markdown delimiters stay literal; only the label between them translates */
  prefix: string;
  suffix: string;
  labelKey: MessageKey;
}

/** Syntax the converter understands, shown as a legend under the editor */
const SYNTAX_CHIPS: readonly SyntaxChip[] = [
  { prefix: '**', suffix: '**', labelKey: 'forward.syntax.bold' },
  { prefix: '*', suffix: '*', labelKey: 'forward.syntax.italic' },
  { prefix: '__', suffix: '__', labelKey: 'forward.syntax.underline' },
  { prefix: '~~', suffix: '~~', labelKey: 'forward.syntax.strike' },
  { prefix: '`', suffix: '`', labelKey: 'forward.syntax.code' },
  { prefix: '[', suffix: '](url)', labelKey: 'forward.syntax.link' },
  { prefix: '> ', suffix: '', labelKey: 'forward.syntax.quote' },
  { prefix: '```', suffix: '```', labelKey: 'forward.syntax.codeblock' },
  { prefix: '||', suffix: '||', labelKey: 'forward.syntax.spoiler' },
];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onLoadSample: () => void;
  onClear: () => void;
}

/** Left column: the markdown input, its length budget and a syntax legend */
export const MarkdownEditor = ({ value, onChange, onLoadSample, onClear }: MarkdownEditorProps) => {
  const { t } = useI18n();
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value),
    [onChange]
  );
  const overLimit = value.length > DEFAULT_MAX_LENGTH;
  const messageParts = Math.ceil(value.length / DEFAULT_MAX_LENGTH);
  const counter = useMemo(
    () => t('forward.counter', { length: value.length, max: DEFAULT_MAX_LENGTH }),
    [t, value.length]
  );
  const chips = useMemo(
    () =>
      SYNTAX_CHIPS.map((chip) => ({
        key: chip.labelKey,
        text: `${chip.prefix}${t(chip.labelKey)}${chip.suffix}`,
      })),
    [t]
  );

  return (
    <section className="section">
      <div className="field-label-row fw-editor-head">
        <label className="field-label" htmlFor="fw-markdown-input">
          {t('forward.markdown.label')}
        </label>
        <span className={overLimit ? 'length-counter over' : 'length-counter'}>{counter}</span>
      </div>
      <textarea
        id="fw-markdown-input"
        className="field fw-textarea"
        value={value}
        rows={13}
        spellCheck={false}
        placeholder={t('forward.placeholder')}
        onChange={handleChange}
      />
      {overLimit && (
        <p className="notice info">
          {t('forward.splitHint', { max: DEFAULT_MAX_LENGTH, parts: messageParts })}
        </p>
      )}
      <div className="fw-editor-foot">
        <div className="fw-editor-buttons">
          <button type="button" className="button ghost" onClick={onLoadSample}>
            {t('forward.sample')}
          </button>
          <button type="button" className="button ghost" onClick={onClear} disabled={value === ''}>
            {t('forward.clear')}
          </button>
        </div>
        <div
          className="chip-row fw-syntax-chips"
          role="group"
          aria-label={t('forward.syntax.label')}
        >
          {chips.map((chip) => (
            <span className="chip" key={chip.key}>
              {chip.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
