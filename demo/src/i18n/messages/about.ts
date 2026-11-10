/**
 * "Learn more" panel strings: capability matrix, how it works, the library,
 * supported syntax and known limits.
 */

export const aboutZh = {
  'about.matrix.title': '平台能力矩阵',
  'about.matrix.intro':
    '同一段内容粘到不同客户端，能还原的程度不一样。高亮行是你当前选中的目标客户端，可在页面上方切换。',
  'about.matrix.col.client': '客户端',
  'about.matrix.col.forward': '方向 1：Markdown → Telegram',
  'about.matrix.col.reverse': '方向 2：Telegram → Markdown',
  'about.matrix.col.note': '说明',
  'about.matrix.current': '当前',
  'about.matrix.legend': '✓ 可用，✗ 不可用。说明列只列影响使用的差异，原因见下方「已知限制」。',
  'about.matrix.card.forward': '方向 1 · Markdown → Telegram',
  'about.matrix.card.reverse': '方向 2 · Telegram → Markdown',

  'about.row.tdesktop.client': 'Telegram Desktop',
  'about.row.tdesktop.forward': '富文本 HTML',
  'about.row.tdesktop.reverse': 'HTML',
  'about.row.tdesktop.note': '代码块的语言名会丢；折叠引用退化为普通引用。',
  'about.row.android.client': 'Android',
  'about.row.android.forward': '富文本 HTML',
  'about.row.android.reverse': 'HTML',
  'about.row.android.note':
    '不认行内代码（会变普通文字）；多行代码块靠 `<br>` 换行；剧透用私有 `<spoiler>` 标签。',
  'about.row.ios.client': 'iOS',
  'about.row.ios.forward': 'Markdown 文本（客户端粘贴时自动转）',
  'about.row.ios.reverse': '只能拿到纯文本',
  'about.row.ios.note': '需客户端「Markdown 粘贴」开启（默认开）；不支持 `||剧透||`。',
  'about.row.macos.client': 'macOS 原生',
  'about.row.macos.forward': '不可用',
  'about.row.macos.reverse': '不可用',
  'about.row.macos.note': '客户端既不读也不写 HTML。',
  'about.row.web.client': 'Telegram 网页版',
  'about.row.web.forward': '富文本 HTML',
  'about.row.web.reverse': 'HTML',
  'about.row.web.note': 'WebK 版复制时还会带精确实体 JSON，解析最准。',
  'about.row.browser.client': '本页（普通浏览器）',
  'about.row.browser.forward': '富文本 HTML',
  'about.row.browser.reverse': '粘贴事件 / 读取剪贴板',
  'about.row.browser.note': 'Chrome 的「读取剪贴板」需要授权。',

  'about.how.title': '这是怎么做到的',
  'about.how.flavors.title': '剪贴板不是「一段文本」',
  'about.how.flavors.body':
    '剪贴板是一个可以同时装多种格式的容器：同一份内容可以带 `text/plain`、`text/html`、`text/rtf`，还可以带客户端自己的私有格式，比如 Telegram Desktop 的 `application/x-td-field-text`、网页版复制时附带的 `data-text-with-entities`。接收方读哪种格式，由它自己决定。',
  'about.how.clients.title': '各客户端读写的格式并不一致',
  'about.how.clients.body':
    '有的客户端只读 `text/html`（Desktop、Android、网页版），有的完全不读（iOS、macOS 原生）；iOS 粘贴时走的是另一条路——把纯文本按 Markdown 解析。所以「复制一条带格式的消息」能还原多少，取决于你用的是哪个客户端，这就是上面那张矩阵存在的原因。',
  'about.how.pipeline.title': '本页做的事：Markdown → entities → 客户端认识的 HTML',
  'about.how.pipeline.body':
    '正向：用 `renderMarkdown` 把 Markdown 渲染成 Bot API 的 `text + entities`，再按目标客户端生成它认识的 HTML，写进剪贴板的 `text/html`。反向：读剪贴板里的 HTML，解析成 `text + entities`，再用 `entitiesToMarkdown` 转回 Markdown。',
  'about.how.local.title': '全程在浏览器里完成',
  'about.how.local.body':
    '没有后端、没有上传、不需要 bot。转换、解析、写剪贴板都在这一个标签页里发生，内容不会离开你的设备。',

  'about.library.title': '背后的库',
  'about.library.intro': '这个页面没有自己实现转换，用的是同一个仓库里的开源库 telegram-md-entities。',
  'about.library.body':
    '`telegram-md-entities` 把 Markdown 渲染成 Telegram Bot API 的 `{ text, entities }`：不经过 `parse_mode`，不需要转义，也就不会出现「can’t parse entities」这类解析错误。',
  'about.library.capability.split': '实体感知的消息分片',
  'about.library.capability.streaming': '流式渲染',
  'about.library.capability.preview': '离线预览',
  'about.library.capability.reverse': '反向 entitiesToMarkdown',
  'about.library.install': '安装',
  'about.library.example': '最小示例',
  'about.library.link.github': 'GitHub 仓库',
  'about.library.link.npm': 'npm 包',

  'about.syntax.title': '支持的 Markdown 语法',
  'about.syntax.intro': '下面这些写法都会转成 Telegram 实体；各客户端最终显示成什么样，见上面的能力矩阵。',
  'about.syntax.bold': '粗体',
  'about.syntax.italic': '斜体',
  'about.syntax.underline': '下划线',
  'about.syntax.strike': '删除线',
  'about.syntax.spoiler': '剧透',
  'about.syntax.code': '行内代码',
  'about.syntax.codeblock': '代码块（带语言）',
  'about.syntax.quote': '引用',
  'about.syntax.details': '折叠引用',
  'about.syntax.link': '链接',
  'about.syntax.autolink': '自动链接',
  'about.syntax.heading': '标题（渲染为粗体）',
  'about.syntax.table': 'GFM 表格',
  'about.syntax.task': '任务列表',
  'about.syntax.hr': '分割线',
  'about.syntax.cjk': 'CJK 友好强调',

  'about.limits.title': '已知限制',
  'about.limits.intro': '下面这些限制大多来自客户端本身，不是转换逻辑能绕开的。',
  'about.limits.ios': 'iOS 与 macOS 原生客户端复制消息时不写 HTML，所以方向 2 只能拿到纯文本。这是客户端行为，网页这边改不了。',
  'about.limits.macos': 'macOS 原生 app 两个方向都不可用：它既不读也不写 HTML。',
  'about.limits.tdesktop': 'Telegram Desktop 会丢掉代码块的语言名（```ts 里的 ts）。',
  'about.limits.android': 'Android 不认行内代码，会把它变成普通文字。',
  'about.limits.quote': '折叠引用在 HTML 通道里会退化成普通引用：折叠状态没有写进 HTML。',
  'about.limits.table': '表格用等宽字符对齐；含中日韩宽字符时会改用列表形式，因为各客户端等宽字体的宽度并不一致。',
} as const;

export const aboutEn: Record<keyof typeof aboutZh, string> = {
  'about.matrix.title': 'Client capability matrix',
  'about.matrix.intro':
    'The same content restores differently depending on the client you paste into. The highlighted row is the target client selected above.',
  'about.matrix.col.client': 'Client',
  'about.matrix.col.forward': 'Direction 1: Markdown → Telegram',
  'about.matrix.col.reverse': 'Direction 2: Telegram → Markdown',
  'about.matrix.col.note': 'Notes',
  'about.matrix.current': 'current',
  'about.matrix.legend':
    '✓ works, ✗ does not. The notes column only lists differences that affect use; see “Known limits” below for the reasons.',
  'about.matrix.card.forward': 'Direction 1 · Markdown → Telegram',
  'about.matrix.card.reverse': 'Direction 2 · Telegram → Markdown',

  'about.row.tdesktop.client': 'Telegram Desktop',
  'about.row.tdesktop.forward': 'rich HTML',
  'about.row.tdesktop.reverse': 'HTML',
  'about.row.tdesktop.note': 'Code-block language names are dropped; collapsed quotes become normal quotes.',
  'about.row.android.client': 'Android',
  'about.row.android.forward': 'rich HTML',
  'about.row.android.reverse': 'HTML',
  'about.row.android.note':
    'No inline code (it becomes plain text); multi-line code blocks use `<br>`; spoilers use a private `<spoiler>` tag.',
  'about.row.ios.client': 'iOS',
  'about.row.ios.forward': 'Markdown text (converted by the client on paste)',
  'about.row.ios.reverse': 'plain text only',
  'about.row.ios.note':
    'Requires the client’s “Paste as Markdown” setting (on by default); `||spoilers||` are not supported.',
  'about.row.macos.client': 'native macOS',
  'about.row.macos.forward': 'not available',
  'about.row.macos.reverse': 'not available',
  'about.row.macos.note': 'The client neither reads nor writes HTML.',
  'about.row.web.client': 'Telegram Web',
  'about.row.web.forward': 'rich HTML',
  'about.row.web.reverse': 'HTML',
  'about.row.web.note': 'WebK also includes an exact entity JSON, which parses most accurately.',
  'about.row.browser.client': 'This page (a regular browser)',
  'about.row.browser.forward': 'rich HTML',
  'about.row.browser.reverse': 'paste event / clipboard read',
  'about.row.browser.note': 'Chrome asks for permission before “read from clipboard”.',

  'about.how.title': 'How it works',
  'about.how.flavors.title': 'A clipboard is not “a piece of text”',
  'about.how.flavors.body':
    'A clipboard holds several formats at once: the same content can carry `text/plain`, `text/html`, `text/rtf`, plus private formats such as Telegram Desktop’s `application/x-td-field-text` or the `data-text-with-entities` payload Web adds. The receiving app decides which one to read.',
  'about.how.clients.title': 'Clients do not read or write the same formats',
  'about.how.clients.body':
    'Some clients read `text/html` (Desktop, Android, Web), some never do (iOS and native macOS). iOS takes a different path on paste: it parses plain text as Markdown. So how much of a copied message can be restored depends on the client you copied it from — that is why the matrix above exists.',
  'about.how.pipeline.title': 'What this page does: Markdown → entities → HTML the client understands',
  'about.how.pipeline.body':
    'Forward: `renderMarkdown` turns Markdown into the Bot API’s `text + entities`, then the page generates the HTML that the target client understands and writes it to the clipboard as `text/html`. Reverse: the page reads the clipboard HTML, parses it into `text + entities`, and `entitiesToMarkdown` turns that back into Markdown.',
  'about.how.local.title': 'It all happens in the browser',
  'about.how.local.body':
    'No backend, no upload, no bot. Conversion, parsing and clipboard writes happen in this tab; the content never leaves your device.',

  'about.library.title': 'The library behind it',
  'about.library.intro':
    'This page does not implement the conversion itself — it uses telegram-md-entities, an open-source library from the same repository.',
  'about.library.body':
    '`telegram-md-entities` renders Markdown into the Bot API’s `{ text, entities }`: no `parse_mode`, no escaping, and therefore no “can’t parse entities” errors.',
  'about.library.capability.split': 'entity-aware splitting',
  'about.library.capability.streaming': 'streaming rendering',
  'about.library.capability.preview': 'offline preview',
  'about.library.capability.reverse': 'reverse entitiesToMarkdown',
  'about.library.install': 'Install',
  'about.library.example': 'Minimal example',
  'about.library.link.github': 'GitHub repository',
  'about.library.link.npm': 'npm package',

  'about.syntax.title': 'Supported Markdown',
  'about.syntax.intro':
    'Everything below becomes Telegram entities; how each client finally renders it is covered by the capability matrix above.',
  'about.syntax.bold': 'bold',
  'about.syntax.italic': 'italic',
  'about.syntax.underline': 'underline',
  'about.syntax.strike': 'strikethrough',
  'about.syntax.spoiler': 'spoiler',
  'about.syntax.code': 'inline code',
  'about.syntax.codeblock': 'code block (with language)',
  'about.syntax.quote': 'quote',
  'about.syntax.details': 'collapsed quote',
  'about.syntax.link': 'link',
  'about.syntax.autolink': 'autolink',
  'about.syntax.heading': 'heading (rendered bold)',
  'about.syntax.table': 'GFM table',
  'about.syntax.task': 'task list',
  'about.syntax.hr': 'divider',
  'about.syntax.cjk': 'CJK-friendly emphasis',

  'about.limits.title': 'Known limits',
  'about.limits.intro':
    'Most of these come from the clients themselves; no conversion logic can work around them.',
  'about.limits.ios':
    'iOS and native macOS do not write HTML when copying a message, so direction 2 only gets plain text. That is client behaviour, not something a web page can change.',
  'about.limits.macos':
    'The native macOS app cannot do either direction: it neither reads nor writes HTML.',
  'about.limits.tdesktop': 'Telegram Desktop drops the code-block language (the ts in ```ts).',
  'about.limits.android': 'Android does not recognise inline code and turns it into plain text.',
  'about.limits.quote':
    'Collapsed quotes degrade to normal quotes on the HTML channel: the collapsed state is not written into the HTML.',
  'about.limits.table':
    'Tables are aligned with monospace characters; tables containing wide CJK characters switch to a list form, because monospace widths differ between clients.',
};
