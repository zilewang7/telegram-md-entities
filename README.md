# telegram-md-entities

Lenient markdown → Telegram Bot API `{ text, entities }` renderer, built for LLM output.

**No `parse_mode`. No escaping. No `can't parse entities`. Ever.**

Instead of serializing markdown into a MarkdownV2 string and praying the server-side parser accepts it, this library renders markdown into plain text plus a [`MessageEntity[]`](https://core.telegram.org/bots/api#messageentity) array — structured data with no syntax to break. Battle-tested against the real Bot API: every fixture in the test corpus round-trips byte-exact through `sendMessage`.

```ts
import { renderMarkdown, splitMessage } from 'telegram-md-entities';

const { text, entities } = renderMarkdown(llmOutput);
await bot.api.sendMessage(chatId, text, { entities }); // grammy / telegraf / raw HTTP — same shape
```

## Why entities instead of MarkdownV2 strings

| MarkdownV2 string pipeline | this library |
|---|---|
| 18 characters need escaping; one miss = HTTP 400 | nothing is ever escaped |
| `can't parse entities` needs fallback chains | structurally impossible |
| code block language lost | `pre.language` preserved (syntax highlighting) |
| visible length = guesswork through the parser | `text.length` is exact (UTF-16, what Telegram counts) |
| splitting breaks formatting at boundaries | entities close & reopen across chunks seamlessly |
| tables become a wall of `\|` | ASCII tables → aligned `pre` grids; CJK tables → clean record lines |

On this repo's 17-fixture corpus, the popular string pipeline (`telegramify-markdown` + `parse_mode`) produces hard 400 parse errors on 3 fixtures; the entities path has zero failures (`RUN_DIFFERENTIAL=1 pnpm test:e2e` reproduces the report).

## API

```ts
renderMarkdown(markdown, options?)   // → { text, entities }
splitMessage(message, options?)      // → chunks fitting maxLength (4096) AND maxEntities (90)
validateMessage(message)             // → offline Bot API rule check (offsets, nesting, budgets)
toPreviewHtml(message, options?)     // → Telegram-like HTML for offline visual review
wrapInBlockquote(message, expandable?) // e.g. LLM "thinking" sections
concatMessages(...parts)             // compose with automatic entity re-offsetting
```

### Streaming mode

```ts
renderMarkdown(buffer, { streaming: true })
```

For token-streaming UIs: unclosed constructs render as their intended formatting instead of literal markers — `**bo` shows as bold, an unclosed ``` fence becomes a live-updating highlighted code block, a half-typed `[label](https://…` shows just the label until the URL completes. On a complete document, streaming output is byte-identical to strict mode, so your final edit is a no-op.

### Markdown coverage

GFM (tables, strikethrough, task lists, autolinks) + `||spoiler||` dialect. Headings → bold; `---` → text divider; nested quotes flattened (Telegram quotes can't nest); bare URLs left for client auto-linking.

**Tables** (`table: 'auto'`, the default): narrow-only tables become a monospace-aligned `pre` grid — exact on every client, since mono fonts are actually monospace for ASCII. Tables containing East Asian Wide characters become record lines instead — `**first cell** — header: value · header: value` per row. This is deliberate: inside Telegram `pre` blocks, CJK ideographs, `U+3000` and fullwidth punctuation resolve to *different* fallback fonts with *different* advance widths on each client (measured live on macOS/Android), so no padding scheme can align a mixed grid everywhere — and padded grids overflow phone bubbles and wrap anyway. Force a mode with `table: 'pre' | 'records' | 'plain'`.

**CJK-friendly emphasis** via [micromark-extension-cjk-friendly](https://www.npmjs.com/package/micromark-extension-cjk-friendly): `的**“重点”**后` renders bold — vanilla CommonMark flanking rules silently break emphasis next to fullwidth punctuation, which hits Chinese/Japanese/Korean LLM output constantly. The streaming tail scanner applies the same relaxed rules, so in-progress CJK bold renders correctly mid-stream too.

## Encoded server behavior

Rules discovered and verified against api.telegram.org (see `test/e2e/`):

- entities beyond **exactly 100** per message are silently dropped (measured: 150 sent → 100 kept) — `splitMessage` budgets 90 per chunk
- characters inside `code`/`pre` are not stylable — formatting is split around them up front
- `text_link` with non-`http(s)`/`tg` URLs (e.g. `mailto:`) is silently dropped — such links degrade to plain text
- the server freely splits/merges entities in its canonical form — the e2e suite compares per-character style maps, not raw entity lists

## Testing

- `pnpm test` — offline: unit + snapshots (entities JSON & preview HTML) + fast-check invariants (arbitrary-input safety, split losslessness, streaming convergence & prefix sweeps)
- `pnpm test:e2e` — real round-trips: sends the corpus to a test chat (`TEST_BOT_TOKEN` / `TEST_CHAT_ID` in `.env`), deep-compares the server-normalized entities from the `sendMessage` response; kept messages double as a visual render gallery
- `pnpm test:probe` / `pnpm test:differential` — one-time entity-cap probe & string-pipeline comparison
- `pnpm visual` — headless-chromium screenshot gallery (`test/visual/screenshots/`): every corpus fixture, streaming frame sequences, and split chunks rendered through the Telegram-calibrated preview for eyeball/visual-diff review
- `pnpm playground` — local playground with live preview, split view and a streaming simulator

## License

MIT
