import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/index';

describe('__underline__ dialect', () => {
    it('renders __text__ as underline', () => {
        const { text, entities } = renderMarkdown('前缀 __下划线__ 后缀');
        expect(text).toBe('前缀 下划线 后缀');
        expect(entities).toEqual([{ type: 'underline', offset: 3, length: 3 }]);
    });

    it('keeps **bold** and _italic_ untouched', () => {
        const { entities } = renderMarkdown('**粗体** 和 _斜体_');
        expect(entities.map((entity) => entity.type)).toEqual(['bold', 'italic']);
    });

    it('renders ___text___ as underline + italic', () => {
        const { text, entities } = renderMarkdown('___全部___');
        expect(text).toBe('全部');
        expect(entities.map((entity) => entity.type).sort()).toEqual(['italic', 'underline']);
    });

    it('supports nesting inside underline', () => {
        const { text, entities } = renderMarkdown('__下划线里有 **粗体**__');
        expect(text).toBe('下划线里有 粗体');
        const types = entities.map((entity) => entity.type);
        expect(types).toContain('underline');
        expect(types).toContain('bold');
    });

    it('does not touch intraword underscores', () => {
        const { text, entities } = renderMarkdown('snake_case_variable 与 double__underscore__word');
        expect(text).toBe('snake_case_variable 与 double__underscore__word');
        expect(entities).toEqual([]);
    });

    it('can be disabled via the underline option', () => {
        const { entities } = renderMarkdown('__文本__', { underline: false });
        expect(entities.map((entity) => entity.type)).toEqual(['bold']);
    });

    it('renders an unclosed __ tail as underline in streaming mode', () => {
        const { text, entities } = renderMarkdown('说明:__进行中的下划线', { streaming: true });
        expect(text).toBe('说明:进行中的下划线');
        expect(entities).toEqual([{ type: 'underline', offset: 3, length: 7 }]);
    });
});
