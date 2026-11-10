import { useCallback, useState } from 'react';
import type { ChannelPlan } from '../../core/types';
import { ChannelActions } from './channel-actions';
import { ChannelStatus } from './channel-status';
import { EntityJson } from './entity-json';
import { MarkdownEditor } from './markdown-editor';
import { PreviewPane } from './preview-pane';
import { useCopyActions } from './use-copy-actions';
import { useForwardActions } from './use-forward-actions';
import { useForwardPreview } from './use-forward-preview';
import './forward.css';

/** Sample that exercises every construct the converter understands */
const SAMPLE_MARKDOWN = [
  '**粗体**、*斜体*、__下划线__、~~删除线~~、`行内代码`',
  '',
  '链接：[示例链接](https://example.com)',
  '',
  '> 引用：把 Markdown 变成 Telegram 富文本。',
  '',
  '```ts',
  "const rendered = renderMarkdown('**hi**');",
  'console.log(rendered.entities.length);',
  '```',
  '',
  '剧透：答案是 ||42||。',
].join('\n');

interface ForwardPanelProps {
  plan: ChannelPlan;
}

/** Direction 1: markdown -> Telegram entities, live preview and copy channels */
export const ForwardPanel = ({ plan }: ForwardPanelProps) => {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const preview = useForwardPreview(markdown);
  const copy = useCopyActions();
  const actions = useForwardActions({ markdown, plan, copy });

  const handleChange = useCallback((next: string) => setMarkdown(next), []);
  const handleLoadSample = useCallback(() => setMarkdown(SAMPLE_MARKDOWN), []);
  const handleClear = useCallback(() => setMarkdown(''), []);

  return (
    <>
      <div className="split fw-split">
        <MarkdownEditor
          value={markdown}
          onChange={handleChange}
          onLoadSample={handleLoadSample}
          onClear={handleClear}
        />
        <PreviewPane preview={preview} />
      </div>

      <section className="section">
        <div className="fw-head">
          <h2 className="section-title">复制到 Telegram</h2>
          <span className="hint">复制后到 Telegram 输入框粘贴</span>
        </div>
        <ChannelActions actions={actions} />
        <ChannelStatus status={copy.status} />
      </section>

      {preview.kind === 'ready' && <EntityJson rendered={preview.rendered} />}

      <section className="section">
        <h2 className="section-title">当前通道</h2>
        <p className="notice info">{plan.note}</p>
      </section>
    </>
  );
};
