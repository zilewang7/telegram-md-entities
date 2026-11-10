import { StepHeading } from './step-heading';

interface PlainFallbackProps {
  text: string;
  /** False once the plain text was already turned into markdown */
  showAction: boolean;
  onUseAsMarkdown: () => void;
}

/** Clipboard carried no HTML: explain the client limitation and offer the plain path */
export const PlainFallback = ({ text, showAction, onUseAsMarkdown }: PlainFallbackProps) => (
  <section className="card rv-step">
    <StepHeading index={2} title="只拿到了纯文本" hint="消息格式没有跟过来" />
    <p className="notice warning">
      你的客户端复制消息时没有写 HTML（iOS / macOS 常见），所以格式没法还原 —— 这是客户端限制，不是本工具的问题。
    </p>
    <div className="field-group">
      <p className="field-label">剪贴板里的纯文本</p>
      <pre className="code-block rv-plain-text">{text}</pre>
    </div>
    {showAction ? (
      <div className="rv-actions">
        <button type="button" className="button secondary" onClick={onUseAsMarkdown}>
          按纯文本输出 Markdown
        </button>
      </div>
    ) : (
      <p className="hint">已按纯文本生成 Markdown，可在下方编辑。</p>
    )}
  </section>
);
