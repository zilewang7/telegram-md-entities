const GITHUB_URL = 'https://github.com/zilewang7/telegram-md-entities';
const NPM_URL = 'https://www.npmjs.com/package/telegram-md-entities';

const FEATURES: readonly string[] = [
  '实体感知的消息分片',
  '流式渲染',
  '离线预览',
  '反向 entitiesToMarkdown',
];

const INSTALL_COMMAND = 'npm install telegram-md-entities';

const MINIMAL_EXAMPLE = `import { renderMarkdown } from 'telegram-md-entities';

const { text, entities } = renderMarkdown('**hi**');
await bot.api.sendMessage(chatId, text, { entities });`;

/** What the library does, where to get it, and the smallest possible usage */
export const LibraryIntro = () => (
  <section className="section">
    <div className="ab-section-head">
      <h2 className="section-title">背后的库</h2>
      <p className="hint">这个页面没有自己实现转换，用的是同一个仓库里的开源库 telegram-md-entities。</p>
    </div>
    <div className="card ab-library">
      <p className="ab-library-text">
        <code>telegram-md-entities</code> 把 Markdown 渲染成 Telegram Bot API 的{' '}
        <code>{'{ text, entities }'}</code>：不经过 <code>parse_mode</code>，不需要转义，也就不会出现
        「can&apos;t parse entities」这类解析错误。
      </p>
      <div className="chip-row">
        {FEATURES.map((feature) => (
          <span key={feature} className="chip">
            {feature}
          </span>
        ))}
      </div>
      <div className="ab-library-links">
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub 仓库
        </a>
        <a href={NPM_URL} target="_blank" rel="noreferrer">
          npm 包
        </a>
      </div>
      <div className="field-group">
        <span className="field-label">安装</span>
        <pre className="code-block">
          <code>{INSTALL_COMMAND}</code>
        </pre>
      </div>
      <div className="field-group">
        <span className="field-label">最小示例</span>
        <pre className="code-block">
          <code>{MINIMAL_EXAMPLE}</code>
        </pre>
      </div>
    </div>
  </section>
);
