# Live demo

The browser tool behind **<https://tgmd.zile.wang>**:

- **Markdown → Telegram**: paste Markdown, copy it as rich text, then paste into a Telegram chat — bold, links, quotes, code blocks and spoilers survive.
- **Telegram → Markdown**: copy a formatted message in Telegram, paste it here, get Markdown back.

Everything runs in the browser; nothing is uploaded and there is no backend.

## Development

```bash
pnpm install
pnpm --filter telegram-md-entities-demo dev
```

The demo imports the library from `../src` through a Vite alias, so it always
exercises the current working tree (the published package still ships `dist`).

## Build

```bash
pnpm --filter telegram-md-entities-demo build   # -> demo/dist
```

## Deploy

```bash
DEMO_DEPLOY_TARGET=user@host:/var/www/tgmd pnpm --filter telegram-md-entities-demo deploy
```

The target is an nginx container on the same host as `zile.wang`, routed by
Traefik (`Host(\`tgmd.zile.wang\`)`) with an automatic Let's Encrypt
certificate (DNS-01 through Cloudflare).

## Layout

- `src/core/` — the conversion pipeline: `markdown → entities → clipboard HTML`
  and the reverse parser for the clipboard dialects of Telegram Desktop,
  Android, WebK and WebA. Pure functions, no DOM.
- `src/lib/clipboard.ts` — the clipboard write chain: async `ClipboardItem`,
  then a `copy` event, then plain text.
- `src/pages/` — the three panels: `forward`, `reverse`, `about`.

`src/core/` mirrors the implementation that ships inside the k-on-bot panel.
Both copies change together until the clipboard rules settle; after that the
shared part is likely to move into the package as a subpath export.
