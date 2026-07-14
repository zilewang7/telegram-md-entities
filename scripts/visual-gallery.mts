/**
 * Visual closed loop: render the corpus (plus streaming frame sequences and
 * split chunks) through toPreviewHtml, screenshot each with headless
 * chromium into test/visual/screenshots/*.png for eyeball review and
 * side-by-side comparison with the real-Telegram gallery chat.
 *
 * Usage: pnpm visual
 */
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
    renderMarkdown,
    splitMessage,
    toPreviewHtml,
    TELEGRAM_PREVIEW_CSS,
} from '../src/index';
import type { RenderedMessage } from '../src/types';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const corpusDir = join(root, 'test/corpus');
const outDir = join(root, 'test/visual/screenshots');

const CHAT_BG = '#89a7c4';

const pageShell = (inner: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><style>
${TELEGRAM_PREVIEW_CSS}
body { margin: 0; padding: 14px; background: ${CHAT_BG}; width: 520px;
       display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.frame-label { font: 500 12px/1 sans-serif; color: #ffffff; opacity: 0.85; margin-top: 2px; }
</style></head><body id="shot">${inner}</body></html>`;

const bubble = (message: RenderedMessage): string =>
    toPreviewHtml(message, { includeStyles: false });

const main = async (): Promise<void> => {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 560, height: 900 } });

    const shoot = async (name: string, innerHtml: string): Promise<void> => {
        await page.setContent(pageShell(innerHtml), { waitUntil: 'load' });
        await page.locator('#shot').screenshot({ path: join(outDir, `${name}.png`) });
        console.log(`  ${name}.png`);
    };

    // 1. Corpus fixtures, one bubble per fixture
    for (const file of readdirSync(corpusDir).filter((f) => f.endsWith('.md')).sort()) {
        const name = file.replace(/\.md$/, '');
        const markdown = readFileSync(join(corpusDir, file), 'utf8');
        await shoot(`corpus-${name}`, bubble(renderMarkdown(markdown)));
    }

    // 2. Streaming frame sequences: watch the tail repair evolve
    const streamingCases: Array<[string, string]> = [
        [
            'stream-bold-and-code',
            '好的!先看 **结论**:这个方案 *可行*。\n\n核心代码:\n```python\ndef check(x):\n    return x > 0\n```\n然后是 ||剧透:其实很简单|| 的部分,最后放个 [参考链接](https://example.com/docs) 收尾。',
        ],
        [
            'stream-real-prose',
            '这可是非常有名的节奏音游**《节奏天国》**呀!🎵✨ 玩家必须严格跟着节拍按键,如果按错、慢半拍或者漏拍,NPC "队友"们就会 ~~毫不留情地~~ 转过头来死死盯着你!😒\n\n> 引用一句评价:节奏感是可以练出来的\n\n结论:多练!🎧',
        ],
    ];
    for (const [name, fullText] of streamingCases) {
        const ratios = [0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0];
        const frames = ratios
            .map((ratio) => {
                const prefix = fullText.slice(0, Math.round(fullText.length * ratio));
                const rendered = renderMarkdown(prefix, { streaming: true });
                const label = `<div class="frame-label">${Math.round(ratio * 100)}%</div>`;
                return label + bubble(rendered);
            })
            .join('');
        await shoot(name, frames);
    }

    // 3. Split chunks: formatting continuing across messages
    const corpusAll = readdirSync(corpusDir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => readFileSync(join(corpusDir, f), 'utf8'))
        .join('\n\n');
    const chunks = splitMessage(renderMarkdown(corpusAll), { maxLength: 1200 });
    for (const [index, chunk] of chunks.entries()) {
        await shoot(
            `split-chunk-${String(index + 1).padStart(2, '0')}-of-${chunks.length}`,
            `<div class="frame-label">chunk ${index + 1}/${chunks.length} · ${chunk.text.length} chars · ${chunk.entities.length} entities</div>` +
                bubble(chunk)
        );
    }

    await browser.close();
    console.log(`\ndone → ${outDir}`);
};

await main();
