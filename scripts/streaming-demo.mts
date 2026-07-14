/**
 * README showpiece: an animated side-by-side of an LLM token stream.
 * Left pane — raw markdown accumulating token by token. Right pane — the
 * message as Telegram displays it, re-rendered with { streaming: true } on
 * EVERY token (production bots throttle edits to Telegram's ~1/s flood
 * limit; each throttled edit would be exactly one of these frames).
 * After typing completes, the view scrolls back to the top of the final
 * message so every rendered construct gets its moment.
 *
 * Frames are rendered through the library's own Telegram-calibrated preview,
 * screenshotted with headless chromium and encoded to animated WebP (far
 * smaller than GIF; GitHub and npmjs both display it as a plain <img>).
 *
 * Usage: pnpm demo   →  assets/streaming-demo.webp
 *        DUMP_FRAMES=1 also writes PNG frames to tmp/demo-frames/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import sharp from 'sharp';
import { renderMarkdown, toPreviewHtml, TELEGRAM_PREVIEW_CSS } from '../src/index';
import type { RenderedMessage } from '../src/types';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const outFile = join(root, 'assets/streaming-demo.webp');

/** What the simulated LLM writes — every construct the library covers */
const DEMO_DOCUMENT = `## Everything Telegram renders — streamed live 🎨

**bold** · *italic* · __underline__ · ~~strike~~ · ||spoiler|| · \`inline code\` · [links](https://github.com/zilewang7/telegram-md-entities)

Half-typed constructs render as their intended style — the fence below appears *before* it closes:

\`\`\`python
def qsort(xs):
    if len(xs) <= 1:
        return xs
    head, *rest = xs
    lo = [x for x in rest if x < head]
    hi = [x for x in rest if x >= head]
    return qsort(lo) + [head] + qsort(hi)
\`\`\`

1. ordered lists
2. nested ones too
    - with bullet children

- [x] task lists, UTF-16-exact offsets
- [ ] escaping bugs (structurally impossible)

ASCII tables align as a monospace grid:

| algo | avg | worst |
|------|-----|-------|
| quicksort | n log n | n² |
| timsort | n log n | n log n |

而 CJK 表格自动降级为记录行——等宽字体对不齐全角字符:

| 算法 | 稳定性 | 备注 |
|------|--------|------|
| 快速排序 | 不稳定 | 原地分治 |
| 归并排序 | 稳定 | 需要辅助数组 |

> 引用块照常:工程实践里,**“常数因子”**才是 ~~魔鬼~~ 决定性因素 🎯

---

<details>
<summary>👉 details/summary → expandable quote 🤫</summary>

The summary becomes a bold header; this content hides below Telegram's collapse fold until tapped.

</details>`;

const TOKENS_PER_FRAME = 4;
const TYPING_DELAY_MS = 110;
const PAUSE_BEFORE_SCROLL_MS = 1400;
const SCROLL_FRAMES = 26;
const SCROLL_DELAY_MS = 90;
const FINAL_HOLD_MS = 4200;
const STAGE_WIDTH = 840;
const STAGE_HEIGHT = 600;

/** BPE-ish chunks: CJK one char at a time, latin a few chars at a time */
const tokenize = (text: string): string[] => {
    const isWide = (char: string): boolean => /[　-鿿＀-￯“”]/.test(char);
    const tokens: string[] = [];
    let index = 0;
    while (index < text.length) {
        const char = text[index];
        if (char === undefined) break;
        if (isWide(char) || char === '\n') {
            tokens.push(char);
            index += 1;
            continue;
        }
        let length = 1;
        while (length < 3) {
            const next = text[index + length];
            if (next === undefined || next === '\n' || isWide(next)) break;
            length += 1;
        }
        tokens.push(text.slice(index, index + length));
        index += length;
    }
    return tokens;
};

interface FrameSpec {
    rawText: string;
    message: RenderedMessage;
    caretVisible: boolean;
    tokenCount: number;
    renderCount: number;
    done: boolean;
    /** px from the top of the right pane, or pinned to the newest content */
    rightScroll: number | 'bottom';
    delayMs: number;
}

const escapeHtml = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pageHtml = (spec: FrameSpec): string => {
    const caret = spec.caretVisible ? '<span class="caret"></span>' : '';
    const bubble =
        spec.message.text === ''
            ? '<div class="waiting">…</div>'
            : toPreviewHtml(spec.message, { includeStyles: false });
    const rightFoot = spec.done
        ? `<span class="ok">✓ complete — byte-identical to the strict render</span>`
        : `re-rendered on every token · render #${spec.renderCount}`;
    return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${TELEGRAM_PREVIEW_CSS}
* { box-sizing: border-box; }
body {
    margin: 0; width: ${STAGE_WIDTH}px; height: ${STAGE_HEIGHT}px;
    background: #0d1319; padding: 14px; display: flex; gap: 13px;
    font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.pane { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column;
        border-radius: 10px; overflow: hidden; border: 1px solid #232d38; }
.head { flex: none; height: 33px; display: flex; align-items: center; gap: 9px;
        padding: 0 12px; background: #161e27; color: #93a1b0;
        font-size: 12.5px; font-weight: 600; letter-spacing: 0.2px; }
.dots { display: flex; gap: 5px; }
.dots i { width: 10px; height: 10px; border-radius: 50%; }
.plane { width: 14px; height: 14px; border-radius: 50%; background: #3390ec;
         color: #fff; font-size: 9px; line-height: 14px; text-align: center; }
.body { flex: 1 1 0; overflow: hidden; }
.left .body { background: #10161d; padding: 12px 14px; }
.raw { margin: 0; font: 400 12.5px/1.6 "SF Mono", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace;
       color: #c6d0da; white-space: pre-wrap; overflow-wrap: break-word; }
.caret { display: inline-block; width: 7px; height: 14px; background: #4ea1ff;
         vertical-align: -2px; border-radius: 1px; }
.right .body { background: #89a7c4; padding: 12px; }
.right .tg-message { font-size: 14.5px; max-width: 100%; width: fit-content; }
.waiting { color: rgba(255, 255, 255, 0.75); font-size: 20px; }
.foot { flex: none; height: 26px; display: flex; align-items: center;
        padding: 0 12px; background: #161e27; color: #66737f;
        font: 400 11px/1 "SF Mono", Menlo, Consolas, monospace; }
.foot .ok { color: #57c26b; }
</style></head><body id="stage">
<div class="pane left">
    <div class="head"><span class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></span>LLM stream · raw markdown tokens</div>
    <div class="body"><pre class="raw">${escapeHtml(spec.rawText)}${caret}</pre></div>
    <div class="foot">tokens: ${spec.tokenCount}&nbsp;· ~36 tok/s</div>
</div>
<div class="pane right">
    <div class="head"><span class="plane">✈</span>Telegram · rendered from { text, entities }</div>
    <div class="body">${bubble}</div>
    <div class="foot">${rightFoot}</div>
</div>
</body></html>`;
};

const buildTypingFrames = (tokens: string[]): FrameSpec[] => {
    const specs: FrameSpec[] = [];
    const frameCount = Math.ceil(tokens.length / TOKENS_PER_FRAME);
    for (let frame = 1; frame <= frameCount; frame += 1) {
        const upTo = Math.min(tokens.length, frame * TOKENS_PER_FRAME);
        const rawText = tokens.slice(0, upTo).join('');
        const isLast = frame === frameCount;
        specs.push({
            rawText,
            // The last frame uses strict mode — proves the convergence claim
            message: renderMarkdown(rawText, { streaming: !isLast }),
            caretVisible: !isLast && frame % 2 === 0,
            tokenCount: upTo,
            renderCount: frame,
            done: isLast,
            rightScroll: 'bottom',
            delayMs: isLast ? PAUSE_BEFORE_SCROLL_MS : TYPING_DELAY_MS,
        });
    }
    return specs;
};

/** Ease from the bottom of the final message back up to its top */
const buildScrollFrames = (finalSpec: FrameSpec, maxScroll: number): FrameSpec[] =>
    Array.from({ length: SCROLL_FRAMES }, (_, index) => {
        const t = index / (SCROLL_FRAMES - 1);
        const offset = Math.round((maxScroll * (1 + Math.cos(Math.PI * t))) / 2);
        return {
            ...finalSpec,
            caretVisible: false,
            rightScroll: offset,
            delayMs: index === SCROLL_FRAMES - 1 ? FINAL_HOLD_MS : SCROLL_DELAY_MS,
        };
    });

const shootFrame = async (page: Page, spec: FrameSpec): Promise<Buffer> => {
    await page.setContent(pageHtml(spec), { waitUntil: 'load' });
    // Pin the left pane to the newest tokens; scroll the right pane to the
    // requested offset (-1 = pinned to the newest rendered content)
    await page.evaluate((rightScroll: number) => {
        const left = document.querySelector('.left .body');
        if (left) left.scrollTop = left.scrollHeight;
        const right = document.querySelector('.right .body');
        if (right) right.scrollTop = rightScroll === -1 ? right.scrollHeight : rightScroll;
    }, spec.rightScroll === 'bottom' ? -1 : spec.rightScroll);
    const shot = await page.locator('#stage').screenshot();
    return Buffer.from(shot);
};

const main = async (): Promise<void> => {
    const tokens = tokenize(DEMO_DOCUMENT);
    const typingSpecs = buildTypingFrames(tokens);
    console.log(`${tokens.length} tokens → ${typingSpecs.length} typing frames`);

    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
    });

    const frames: Buffer[] = [];
    const delays: number[] = [];
    const shoot = async (spec: FrameSpec): Promise<void> => {
        frames.push(await shootFrame(page, spec));
        delays.push(spec.delayMs);
        if (frames.length % 25 === 0) console.log(`  frame ${frames.length}`);
    };

    for (const spec of typingSpecs) await shoot(spec);

    // The final typing frame is still on the page: measure its scroll range
    const maxScroll = await page.evaluate(() => {
        const body = document.querySelector('.right .body');
        return body ? body.scrollHeight - body.clientHeight : 0;
    });
    const finalSpec = typingSpecs[typingSpecs.length - 1];
    if (finalSpec === undefined) throw new Error('no typing frames built');
    if (maxScroll > 0) {
        for (const spec of buildScrollFrames(finalSpec, maxScroll)) await shoot(spec);
    }
    await browser.close();

    // DUMP_FRAMES=1: also write every 8th frame as PNG for visual inspection
    if (process.env['DUMP_FRAMES']) {
        const dumpDir = join(root, 'tmp/demo-frames');
        mkdirSync(dumpDir, { recursive: true });
        frames.forEach((png, index) => {
            if (index % 8 !== 0 && index !== frames.length - 1) return;
            writeFileSync(join(dumpDir, `frame-${String(index).padStart(3, '0')}.png`), png);
        });
    }

    console.log(`encoding ${frames.length} frames…`);
    const webp = await sharp(frames, { join: { animated: true } })
        .webp({ quality: 74, effort: 6, loop: 0, delay: delays, minSize: true, mixed: true })
        .toBuffer();

    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, webp);
    console.log(`done → ${outFile} (${(webp.length / 1024 / 1024).toFixed(2)} MB)`);
};

await main();
