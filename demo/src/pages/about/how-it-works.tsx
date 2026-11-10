import type { ReactNode } from 'react';

interface Step {
  title: string;
  body: ReactNode;
}

const STEPS: readonly Step[] = [
  {
    title: '剪贴板不是「一段文本」',
    body: (
      <>
        剪贴板是一个可以同时装多种格式的容器：同一份内容可以带 <code>text/plain</code>、
        <code>text/html</code>、<code>text/rtf</code>，还可以带客户端自己的私有格式，比如 Telegram
        Desktop 的 <code>application/x-td-field-text</code>、网页版复制时附带的{' '}
        <code>data-text-with-entities</code>。接收方读哪种格式，由它自己决定。
      </>
    ),
  },
  {
    title: '各客户端读写的格式并不一致',
    body: (
      <>
        有的客户端只读 <code>text/html</code>（Desktop、Android、网页版），有的完全不读（iOS、macOS
        原生）；iOS 粘贴时走的是另一条路——把纯文本按 Markdown 解析。所以「复制一条带格式的消息」
        能还原多少，取决于你用的是哪个客户端，这就是上面那张矩阵存在的原因。
      </>
    ),
  },
  {
    title: '本页做的事：Markdown → entities → 客户端认识的 HTML',
    body: (
      <>
        正向：用 <code>renderMarkdown</code> 把 Markdown 渲染成 Bot API 的{' '}
        <code>text + entities</code>，再按目标客户端生成它认识的 HTML，写进剪贴板的{' '}
        <code>text/html</code>。反向：读剪贴板里的 HTML，解析成 <code>text + entities</code>，再用{' '}
        <code>entitiesToMarkdown</code> 转回 Markdown。
      </>
    ),
  },
  {
    title: '全程在浏览器里完成',
    body: (
      <>
        没有后端、没有上传、不需要 bot。转换、解析、写剪贴板都在这一个标签页里发生，内容不会离开你的设备。
      </>
    ),
  },
];

/** The clipboard mechanics behind both directions, in four short steps */
export const HowItWorks = () => (
  <section className="section">
    <div className="ab-section-head">
      <h2 className="section-title">这是怎么做到的</h2>
    </div>
    <ol className="ab-steps">
      {STEPS.map((step, index) => (
        <li key={step.title} className="ab-step">
          <span className="ab-step-index" aria-hidden="true">
            {index + 1}
          </span>
          <div className="ab-step-body">
            <h3 className="ab-step-title">{step.title}</h3>
            <p className="ab-step-text">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  </section>
);
