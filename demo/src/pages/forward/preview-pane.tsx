import { match } from 'ts-pattern';
import { PreviewBubble } from './preview-bubble';
import type { ForwardPreview } from './use-forward-preview';

interface PreviewPaneProps {
  preview: ForwardPreview;
}

/** Right column: how the message will look inside a Telegram client */
export const PreviewPane = ({ preview }: PreviewPaneProps) => {
  const summary = match(preview)
    .with({ kind: 'ready' }, ({ rendered }) => `${rendered.entities.length} 个实体`)
    .otherwise(() => null);

  return (
    <section className="section">
      <div className="field-label-row">
        <h2 className="field-label">预览</h2>
        {summary !== null && <span className="hint">{summary}</span>}
      </div>
      <div className="fw-stage">
        {match(preview)
          .with({ kind: 'empty' }, () => (
            <p className="hint fw-stage-empty">输入 Markdown 后，这里会显示 Telegram 风格的预览。</p>
          ))
          .with({ kind: 'failed' }, () => (
            <p className="error-text">这段 Markdown 无法渲染，请检查内容。</p>
          ))
          .with({ kind: 'ready' }, ({ previewHtml }) => <PreviewBubble html={previewHtml} />)
          .exhaustive()}
      </div>
      <p className="hint">按 Telegram 客户端的样式渲染，仅供参考。</p>
    </section>
  );
};
