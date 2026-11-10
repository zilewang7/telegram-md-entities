interface SyntaxItem {
  name: string;
  /** Literal markdown sample, shown in mono */
  sample: string;
}

const SYNTAX_ITEMS: readonly SyntaxItem[] = [
  { name: '粗体', sample: '**x**' },
  { name: '斜体', sample: '*x* / _x_' },
  { name: '下划线', sample: '__x__' },
  { name: '删除线', sample: '~~x~~' },
  { name: '剧透', sample: '||x||' },
  { name: '行内代码', sample: '`x`' },
  { name: '代码块（带语言）', sample: '```ts' },
  { name: '引用', sample: '> x' },
  { name: '折叠引用', sample: '<details>' },
  { name: '链接', sample: '[文字](url)' },
  { name: '自动链接', sample: 'https://…' },
  { name: '标题（渲染为粗体）', sample: '# x' },
  { name: 'GFM 表格', sample: '| a | b |' },
  { name: '任务列表', sample: '- [x]' },
  { name: '分割线', sample: '---' },
  { name: 'CJK 友好强调', sample: '中文**“重点”**后' },
];

/** The markdown dialect the forward direction accepts, as scannable chips */
export const SyntaxSupport = () => (
  <section className="section">
    <div className="ab-section-head">
      <h2 className="section-title">支持的 Markdown 语法</h2>
      <p className="hint">
        下面这些写法都会转成 Telegram 实体；各客户端最终显示成什么样，见上面的能力矩阵。
      </p>
    </div>
    <div className="card ab-syntax">
      <ul className="chip-row ab-syntax-list">
        {SYNTAX_ITEMS.map((item) => (
          <li key={item.name} className="chip ab-syntax-item">
            <code className="ab-syntax-sample">{item.sample}</code>
            <span className="ab-syntax-name">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
