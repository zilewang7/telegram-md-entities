import type { ChangeEvent } from 'react';
import type { CopyStatus } from './reverse-types';
import { StepHeading } from './step-heading';

interface MarkdownResultProps {
  markdown: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onCopy: () => void;
  status: CopyStatus | null;
}

/** Step 3: editable markdown plus the copy button and its outcome */
export const MarkdownResult = ({ markdown, onChange, onCopy, status }: MarkdownResultProps) => (
  <section className="card rv-step">
    <StepHeading index={3} title="Markdown 输出" hint="可以直接修改，再复制" />
    <div className="field-group">
      <div className="field-label-row">
        <label className="field-label" htmlFor="rv-markdown-output">
          Markdown
        </label>
        <span className="hint">{markdown.length} 字符</span>
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
        复制 Markdown
      </button>
    </div>
    {status !== null && (
      <p className={status.tone === 'success' ? 'success-text' : 'error-text'} role="status">
        {status.message}
      </p>
    )}
  </section>
);
