import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { DEFAULT_MAX_LENGTH } from 'telegram-md-entities';
import { LengthCounter } from '../../components/length-counter';

/** Syntax the converter understands, shown as a legend under the editor */
const SYNTAX_CHIPS: readonly string[] = [
  '**粗体**',
  '*斜体*',
  '__下划线__',
  '~~删除线~~',
  '`行内代码`',
  '[链接](url)',
  '> 引用',
  '```代码块```',
  '||剧透||',
];

const PLACEHOLDER = '在这里粘贴 Markdown：**粗体**、`行内代码`、> 引用、```代码块```、[链接](https://example.com)';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onLoadSample: () => void;
  onClear: () => void;
}

/** Left column: the markdown input, its length budget and a syntax legend */
export const MarkdownEditor = ({ value, onChange, onLoadSample, onClear }: MarkdownEditorProps) => {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value),
    [onChange]
  );
  const overLimit = value.length > DEFAULT_MAX_LENGTH;
  const messageParts = Math.ceil(value.length / DEFAULT_MAX_LENGTH);

  return (
    <section className="section">
      <div className="field-label-row fw-editor-head">
        <label className="field-label" htmlFor="fw-markdown-input">
          Markdown
        </label>
        <LengthCounter length={value.length} max={DEFAULT_MAX_LENGTH} />
      </div>
      <textarea
        id="fw-markdown-input"
        className="field fw-textarea"
        value={value}
        rows={13}
        spellCheck={false}
        placeholder={PLACEHOLDER}
        onChange={handleChange}
      />
      {overLimit && (
        <p className="notice warning">
          超过 Telegram 单条上限 {DEFAULT_MAX_LENGTH} 字符（约 {messageParts} 条），发送时可能需要手动分条。
        </p>
      )}
      <div className="fw-editor-foot">
        <div className="fw-editor-buttons">
          <button type="button" className="button ghost" onClick={onLoadSample}>
            载入示例
          </button>
          <button type="button" className="button ghost" onClick={onClear} disabled={value === ''}>
            清空
          </button>
        </div>
        <div className="chip-row fw-syntax-chips">
          {SYNTAX_CHIPS.map((chip) => (
            <span className="chip" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
