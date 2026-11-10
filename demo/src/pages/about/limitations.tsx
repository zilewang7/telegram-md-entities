const LIMITATIONS: readonly string[] = [
  'iOS 与 macOS 原生客户端复制消息时不写 HTML，所以方向 2 只能拿到纯文本。这是客户端行为，网页这边改不了。',
  'macOS 原生 app 两个方向都不可用：它既不读也不写 HTML。',
  'Telegram Desktop 会丢掉代码块的语言名（```ts 里的 ts）。',
  'Android 不认行内代码，会把它变成普通文字。',
  '折叠引用在 HTML 通道里会退化成普通引用：折叠状态没有写进 HTML。',
  '表格用等宽字符对齐；含中日韩宽字符时会改用列表形式，因为各客户端等宽字体的宽度并不一致。',
];

/** The honest limits: most of them come from the clients, not the converter */
export const KnownLimitations = () => (
  <section className="section">
    <div className="ab-section-head">
      <h2 className="section-title">已知限制</h2>
      <p className="hint">下面这些限制大多来自客户端本身，不是转换逻辑能绕开的。</p>
    </div>
    <ul className="card ab-limits">
      {LIMITATIONS.map((item) => (
        <li key={item} className="ab-limit">
          {item}
        </li>
      ))}
    </ul>
  </section>
);
