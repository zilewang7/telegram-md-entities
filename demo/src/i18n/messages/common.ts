/**
 * App-level strings: header, tabs, platform picker, channel notes and footer.
 * `commonZh` is the source of truth for the key set; every other locale must
 * cover exactly those keys (enforced by the Record type).
 */

export const commonZh = {
  'app.kicker': 'TELEGRAM · MARKDOWN',
  'app.title': 'Telegram 富文本剪贴板',
  'app.documentTitle': 'Telegram 富文本剪贴板 — Markdown 与 Telegram 格式互转',
  'app.description':
    '把 Markdown 变成能直接粘进 Telegram 输入框的富文本，或把 Telegram 消息还原成 Markdown。全部在浏览器本地完成，不上传任何内容。',
  'app.subtitle':
    '把 Markdown 变成能直接粘进 Telegram 输入框的富文本，或者把 Telegram 消息还原成 Markdown。全部在你的浏览器里完成，内容不会上传。',
  'app.link.github': 'GitHub',
  'app.link.npm': 'npm',
  'app.link.site': 'zile.wang',
  'app.footer.drivenBy': '由 telegram-md-entities 驱动 · 内容只在本地处理，不上传服务器',
  'app.footer.tips': 'iOS 首次粘贴可能弹系统授权提示；Android 13+ 会显示剪贴板预览，属系统行为。',
  'app.locale.label': '语言',
  'app.locale.switch': '切换到 English',

  'tabs.label': '功能',
  'tab.forward': 'Markdown → Telegram',
  'tab.forward.short': '→ Telegram',
  'tab.reverse': 'Telegram → Markdown',
  'tab.reverse.short': '→ Markdown',
  'tab.about': '了解更多',
  'tab.about.short': '了解更多',

  'platform.label': '目标客户端',
  'platform.hint': '选你打算把内容粘贴进去的那个客户端',
  'platform.groupLabel': '目标客户端',
  'platform.tdesktop': 'Desktop',
  'platform.android': 'Android',
  'platform.ios': 'iOS',
  'platform.macos': 'macOS',
  'platform.web': '网页版',

  'channel.note.tdesktop':
    '桌面版支持富文本粘贴：复制后到输入框粘贴即可；代码块语言会丢失，折叠引用会退化为普通引用。',
  'channel.note.android':
    'Android 支持富文本粘贴：行内代码会变成普通文字，多行代码块已按 Android 的换行规则处理。',
  'channel.note.ios': 'iOS 客户端在粘贴 Markdown 时会自动转成格式；剧透会退化为普通文字。',
  'channel.note.macos':
    'macOS 原生客户端对 HTML 剪贴板支持有限，Markdown 通道也可能不生效；建议使用桌面版 Telegram。',
  'channel.note.web': '浏览器版支持富文本粘贴；若浏览器拦截剪贴板，可改用 Markdown 文本通道。',
  'channel.note.unknown': '未识别客户端：先试富文本，失败再试 Markdown 文本。',

  'reverse.note.tdesktop':
    'Desktop 复制消息时会写入 HTML，粘贴到这里即可还原格式。代码块的语言名在导出时丢失，属正常。',
  'reverse.note.android':
    'Android 复制消息时会写入 HTML，粘贴到这里即可还原。注意 Android 不认行内代码，那部分会变成普通文字。',
  'reverse.note.web':
    'Telegram 网页版复制消息时会写入 HTML（WebK 还会带上精确实体 JSON），粘贴到这里即可还原。',
  'reverse.note.ios': 'iOS 复制消息时不写 HTML，只能拿到纯文本 —— 这是客户端限制，不是本工具的问题。',
  'reverse.note.macos':
    'macOS 原生客户端复制消息时不写 HTML，只能拿到纯文本 —— 这是客户端限制，不是本工具的问题。',
  'reverse.note.unknown': '',
} as const;

export const commonEn: Record<keyof typeof commonZh, string> = {
  'app.kicker': 'TELEGRAM · MARKDOWN',
  'app.title': 'Telegram rich paste',
  'app.documentTitle': 'Telegram rich paste — Markdown ⇄ Telegram formatting',
  'app.description':
    'Turn Markdown into rich text you can paste straight into Telegram, or turn a copied Telegram message back into Markdown. Everything runs in your browser; nothing is uploaded.',
  'app.subtitle':
    'Turn Markdown into rich text you can paste straight into Telegram, or turn a copied Telegram message back into Markdown. Everything runs in your browser — nothing is uploaded.',
  'app.link.github': 'GitHub',
  'app.link.npm': 'npm',
  'app.link.site': 'zile.wang',
  'app.footer.drivenBy': 'Powered by telegram-md-entities · processed locally, never uploaded',
  'app.footer.tips':
    'iOS may ask for paste permission the first time; Android 13+ shows a clipboard preview — both are system behaviour.',
  'app.locale.label': 'Language',
  'app.locale.switch': 'Switch to 中文',

  'tabs.label': 'Panels',
  'tab.forward': 'Markdown → Telegram',
  'tab.forward.short': '→ Telegram',
  'tab.reverse': 'Telegram → Markdown',
  'tab.reverse.short': '→ Markdown',
  'tab.about': 'Learn more',
  'tab.about.short': 'Learn more',

  'platform.label': 'Target client',
  'platform.hint': 'Pick the client you will paste into',
  'platform.groupLabel': 'Target client',
  'platform.tdesktop': 'Desktop',
  'platform.android': 'Android',
  'platform.ios': 'iOS',
  'platform.macos': 'macOS',
  'platform.web': 'Web',

  'channel.note.tdesktop':
    'Desktop supports rich-text paste: copy, then paste into the input box. The code-block language is dropped and collapsed quotes degrade to normal quotes.',
  'channel.note.android':
    'Android supports rich-text paste: inline code becomes plain text, and multi-line code blocks already follow Android’s line-break rules.',
  'channel.note.ios':
    'The iOS client converts Markdown automatically on paste; spoilers degrade to plain text.',
  'channel.note.macos':
    'The native macOS client has limited HTML clipboard support and the Markdown channel may not work either; Telegram Desktop is the safer choice.',
  'channel.note.web':
    'Telegram Web supports rich-text paste; if the browser blocks the clipboard, use the Markdown channel instead.',
  'channel.note.unknown':
    'Unrecognised client: try rich text first, then fall back to Markdown text.',

  'reverse.note.tdesktop':
    'Desktop writes HTML when you copy a message, so pasting here restores the formatting. Code-block language names are lost on export — that is expected.',
  'reverse.note.android':
    'Android writes HTML when you copy a message, so pasting here restores it. Android does not recognise inline code, so those runs come back as plain text.',
  'reverse.note.web':
    'Telegram Web writes HTML when you copy a message (WebK also includes an exact entity JSON), so pasting here restores it.',
  'reverse.note.ios':
    'iOS does not write HTML when copying, so only plain text arrives — a client limitation, not this tool.',
  'reverse.note.macos':
    'The native macOS client does not write HTML when copying, so only plain text arrives — a client limitation, not this tool.',
  'reverse.note.unknown': '',
};
