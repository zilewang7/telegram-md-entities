import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/index';

/**
 * The design-doc §1.5 edge-case table: each entry is a mid-stream buffer
 * tail; snapshots pin the exact streaming render.
 */
const CASES: Array<[name: string, buffer: string]> = [
    ['unclosed bold', '前文 **加粗未闭合的流式片段'],
    ['literal double star', 'a ** b 应保持字面'],
    ['trailing lone star', '价格 5 *'],
    ['unclosed italic nested in bold', '*a **b'],
    ['unclosed inline code hides other markers', '这是 `code **不加粗'],
    ['unclosed fence with language', '说明:\n```python\nprint(1)'],
    ['fence inside quote', '> 引用里\n> ```js\n> const x = 1;'],
    ['half link url hidden', '看这个 [链接文本](https://exa'],
    ['half image alt kept', '图 ![替代文本](https://par'],
    ['bold spanning half link', '**重点 [标签](https://ur'],
    ['escaped stars untouched', '转义 \\*\\*不是加粗'],
    ['unclosed spoiler', '剧透 ||还没结束'],
    ['unclosed strikethrough', '划掉 ~~这一段'],
    ['plain label bracket stays literal', '引用文献 [1] 和 [未完成'],
    ['partial table header', '| 名称 | 数量 |\n| ---'],
    ['complete doc passes through', '完整 **文档** 不受影响。\n\n- 列表\n- 结束'],
];

describe('streaming render snapshots (§1.5 table)', () => {
    for (const [name, buffer] of CASES) {
        it(name, () => {
            expect(renderMarkdown(buffer, { streaming: true })).toMatchSnapshot();
        });
    }
});
