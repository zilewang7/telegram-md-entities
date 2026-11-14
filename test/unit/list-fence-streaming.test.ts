import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, toRichMarkdown } from '../../src/index';
import { repairTail } from '../../src/streaming/repair-tail';

/** What the bot appends after a streaming frame */
const STATUS_LINE = '\n\n<p><i>x</i></p>';

/** The appended status line is its own paragraph, under no code block */
const expectStatusOutside = (frame: string): void => {
    const rendered = renderMarkdown(frame + STATUS_LINE);
    expect(rendered.text.endsWith('<p>x</p>'), JSON.stringify(frame)).toBe(true);
    const statusAt = rendered.text.length - 'x</p>'.length;
    const covering = rendered.entities
        .filter((entity) => entity.offset <= statusAt && entity.offset + entity.length > statusAt)
        .map((entity) => entity.type);
    expect(covering, JSON.stringify(frame)).toEqual(['italic']);
};

describe('streaming: a fence opened in a list item closes at the item indentation', () => {
    it.each([
        ['ordered item', '1. 安装：\n   ```bash\n   npm i', '1. 安装：\n   ```bash\n   npm i\n   ```'],
        ['unordered item', '- a\n  ```js\n  x', '- a\n  ```js\n  x\n  ```'],
        ['nested item', '- a\n  - b\n    ```js\n    x', '- a\n  - b\n    ```js\n    x\n    ```'],
        ['list in a quote', '> 1. 安装：\n>    ```bash\n>    npm i', '> 1. 安装：\n>    ```bash\n>    npm i\n>    ```'],
        ['nested list in a quote, ~~~', '> - a\n>   - b\n>     ~~~\n>     y', '> - a\n>   - b\n>     ~~~\n>     y\n>     ~~~'],
        ['fence on the marker line', '1. ~~~\n   x', '1. ~~~\n   x\n   ~~~'],
        ['longer fence', '- a\n  ````md\n  ```\n  y', '- a\n  ````md\n  ```\n  y\n  ````'],
        ['blank line inside the fence', '* ```py\n  print(1)\n\n  x = 2', '* ```py\n  print(1)\n\n  x = 2\n  ```'],
    ])('%s', (_name, frame, expected) => {
        expect(toRichMarkdown(frame, { streaming: true })).toBe(expected);
        expect(repairTail(frame).repaired).toBe(expected);
        expectStatusOutside(toRichMarkdown(frame, { streaming: true }));
    });

    it('without list items, fences close exactly as before', () => {
        expect(repairTail('```js\nx').repaired).toBe('```js\nx\n```');
        expect(repairTail('> ```js\n> x').repaired).toBe('> ```js\n> x\n> ```');
        expect(repairTail('  ```js\n  x').repaired).toBe('  ```js\n  x\n```');
    });

    it('a lazy line keeps the list item open', () => {
        expect(repairTail('- item\nplain\n  ```\n  x').repaired).toBe('- item\nplain\n  ```\n  x\n  ```');
        expect(repairTail('- a\n  - b\nlazy\n    ```js\n    x').repaired).toBe(
            '- a\n  - b\nlazy\n    ```js\n    x\n    ```'
        );
    });

    it('a closed list fence, or a line that leaves the item, needs no closer', () => {
        expect(repairTail('- a\n  ```js\n  x\n  ```\n- b').repaired).toBe('- a\n  ```js\n  x\n  ```\n- b');
        expect(repairTail('- a\n  ```js\n  x\nafter').repaired).toBe('- a\n  ```js\n  x\nafter');
    });

    it('the entities streaming render shows the list fence as before', () => {
        expect(renderMarkdown('1. 安装：\n   ```bash\n   npm i', { streaming: true })).toEqual({
            text: '1. 安装：\nnpm i',
            entities: [{ type: 'pre', offset: 7, length: 5, language: 'bash' }],
        });
    });

    it('any prefix of a list with fences keeps the appended status line outside every code block', () => {
        const line = fc.constantFrom(
            '- item', '1. step', '  - nested', '    - deeper', '  ```js', '    ```py', '   ~~~', '      ```',
            '  ````md', '  ```', '    code line', '  text', 'plain', '', '* ```sh', '   x = 1'
        );
        // Quoted documents carry the prefix on every line: a fence in a quote
        // followed by a line without '>' is a separate, older limitation
        fc.assert(
            fc.property(fc.array(line, { maxLength: 8 }), fc.boolean(), (lines, quoted) => {
                const document = lines.map((text) => (quoted ? `> ${text}` : text)).join('\n');
                for (let cut = 1; cut <= document.length; cut += 1) {
                    const frame = toRichMarkdown(document.slice(0, cut), { streaming: true });
                    if (renderMarkdown(frame).text === '') continue;
                    expectStatusOutside(frame);
                }
            }),
            { numRuns: 40 }
        );
    }, 20_000);
});
