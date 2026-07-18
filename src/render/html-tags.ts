/**
 * HTML formatting tags → entities. LLMs mix Telegram-style HTML (<b>, <i>,
 * <code>, <a href>…) into markdown output; mdast keeps raw HTML as opaque
 * html nodes (inline: one tag per node, interleaved with text/formatting
 * nodes; block: one node carrying the whole raw chunk). Tags are tokenized
 * and drive the emitter through a pairing stack shared across the sibling
 * nodes of a block. Lenient by design:
 *   - unknown tags stay literal text (never lose content)
 *   - unclosed known tags close at block end (entity covers the rest)
 *   - stray closes of known tags are dropped
 *   - mismatched nesting recovers by close-and-reopen (proper entity nesting)
 */
import { match } from 'ts-pattern';
import type { Emitter, EntityHandle, EntitySpec } from './emitter';
import { resolveLinkTarget } from './link-target';

export interface HtmlTagFrame {
    /** Lowercased tag name — the pairing key for the matching close tag */
    name: string;
    /** null when the pair emits no entity (invalid href, code inside pre) */
    handle: EntityHandle | null;
    /** Kept for reopening after a close-and-reopen nesting recovery */
    spec: EntitySpec | null;
    /** Emitter cursor at open time (detects "no content emitted yet") */
    cursorAtOpen: number;
    /** Set on <ul>/<ol> frames: item counter for the ordered marker */
    list?: { ordered: boolean; count: number };
}

type HtmlToken =
    | { kind: 'text'; value: string }
    | { kind: 'tag'; name: string; attrs: string; raw: string; closing: boolean; selfClosing: boolean };

// Quoted attribute values may contain '>' — consume them as units
const TAG_PATTERN = /<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'<>])*?)(\/?)>/g;
const HREF_ATTR = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const CLASS_ATTR = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const LANGUAGE_CLASS = /(?:^|\s)language-([^\s]+)/;

const tokenizeHtml = (value: string): HtmlToken[] => {
    const tokens: HtmlToken[] = [];
    const scanner = new RegExp(TAG_PATTERN.source, 'g');
    let lastIndex = 0;
    let matched = scanner.exec(value);
    while (matched !== null) {
        if (matched.index > lastIndex) {
            tokens.push({ kind: 'text', value: value.slice(lastIndex, matched.index) });
        }
        tokens.push({
            kind: 'tag',
            name: (matched[2] ?? '').toLowerCase(),
            attrs: matched[3] ?? '',
            raw: matched[0],
            closing: matched[1] === '/',
            selfClosing: matched[4] === '/',
        });
        lastIndex = matched.index + matched[0].length;
        matched = scanner.exec(value);
    }
    if (lastIndex < value.length) {
        tokens.push({ kind: 'text', value: value.slice(lastIndex) });
    }
    return tokens;
};

const classAttrOf = (attrs: string): string => {
    const matched = CLASS_ATTR.exec(attrs);
    return matched?.[1] ?? matched?.[2] ?? matched?.[3] ?? '';
};

type TagMeaning =
    | { kind: 'entity'; spec: EntitySpec }
    | { kind: 'silent' }
    | { kind: 'list'; ordered: boolean }
    | { kind: 'item' }
    | { kind: 'literal' };

/** Telegram parse_mode=HTML tag set (span is spoiler-only, like Telegram's) */
const classifyOpenTag = (name: string, attrs: string): TagMeaning =>
    match<string, TagMeaning>(name)
        .with('b', 'strong', () => ({ kind: 'entity', spec: { type: 'bold' } }))
        .with('i', 'em', () => ({ kind: 'entity', spec: { type: 'italic' } }))
        .with('u', 'ins', () => ({ kind: 'entity', spec: { type: 'underline' } }))
        .with('s', 'strike', 'del', () => ({ kind: 'entity', spec: { type: 'strikethrough' } }))
        .with('code', () => ({ kind: 'entity', spec: { type: 'code' } }))
        .with('pre', () => ({ kind: 'entity', spec: { type: 'pre' } }))
        .with('tg-spoiler', () => ({ kind: 'entity', spec: { type: 'spoiler' } }))
        .with('ul', () => ({ kind: 'list', ordered: false }))
        .with('ol', () => ({ kind: 'list', ordered: true }))
        .with('li', () => ({ kind: 'item' }))
        .with('span', () =>
            /(?:^|\s)tg-spoiler(?:\s|$)/.test(classAttrOf(attrs))
                ? { kind: 'entity', spec: { type: 'spoiler' } }
                : { kind: 'literal' }
        )
        .with('a', () => {
            const matched = HREF_ATTR.exec(attrs);
            const href = matched?.[1] ?? matched?.[2] ?? matched?.[3] ?? '';
            const target = resolveLinkTarget(href);
            // Missing/unsupported href: keep the label text, emit no entity
            return target === null
                ? { kind: 'silent' }
                : { kind: 'entity', spec: { type: 'text_link', url: target } };
        })
        .otherwise(() => ({ kind: 'literal' }));

// Close tags with these names pair with the stack / drop when unmatched;
// span is resolved through the stack only (a literal <span> stays literal)
const KNOWN_CLOSE_NAMES = new Set([
    'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del',
    'code', 'pre', 'a', 'tg-spoiler', 'ul', 'ol', 'li',
]);

const frameIndexFromTop = (stack: HtmlTagFrame[], name: string): number => {
    for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index]?.name === name) return index;
    }
    return -1;
};

const listDepthOf = (stack: HtmlTagFrame[]): number =>
    stack.filter((frame) => frame.list !== undefined).length;

const nearestList = (stack: HtmlTagFrame[]): HtmlTagFrame | undefined => {
    for (let index = stack.length - 1; index >= 0; index -= 1) {
        const frame = stack[index];
        if (frame?.list) return frame;
    }
    return undefined;
};

/** <li>: emit a line break + indent + marker, mirroring the markdown list style */
const openListItem = (emitter: Emitter, stack: HtmlTagFrame[]): void => {
    const container = nearestList(stack);
    const indent = '    '.repeat(Math.max(0, listDepthOf(stack) - 1));
    let marker = '• ';
    if (container?.list) {
        container.list.count += 1;
        if (container.list.ordered) marker = `${container.list.count}. `;
    }
    emitter.pushGap('\n');
    emitter.pushText(indent + marker);
    stack.push({ name: 'li', handle: null, spec: null, cursorAtOpen: emitter.cursor() });
};

const openFrame = (
    name: string,
    meaning: TagMeaning,
    emitter: Emitter,
    stack: HtmlTagFrame[]
): void => {
    if (meaning.kind === 'literal') return;
    if (meaning.kind === 'list') {
        stack.push({
            name,
            handle: null,
            spec: null,
            cursorAtOpen: emitter.cursor(),
            list: { ordered: meaning.ordered, count: 0 },
        });
        return;
    }
    if (meaning.kind === 'item') {
        openListItem(emitter, stack);
        return;
    }
    let spec = meaning.kind === 'entity' ? meaning.spec : null;
    // Telegram has no nested code-in-pre: <pre><code> collapses into the
    // pre entity; a language-xxx class upgrades a still-empty pre in place
    if (spec?.type === 'code') {
        const enclosingPre = stack.find((frame) => frame.spec?.type === 'pre');
        if (enclosingPre) {
            spec = null;
        }
    }
    stack.push({
        name,
        handle: spec ? emitter.openEntity(spec) : null,
        spec,
        cursorAtOpen: emitter.cursor(),
    });
};

const upgradePreLanguage = (
    attrs: string,
    emitter: Emitter,
    stack: HtmlTagFrame[]
): void => {
    const language = LANGUAGE_CLASS.exec(classAttrOf(attrs))?.[1];
    if (language === undefined) return;
    const top = stack[stack.length - 1];
    // Only <pre><code class="language-x"> with nothing in between qualifies
    if (!top || top.spec?.type !== 'pre' || top.handle === null) return;
    if (top.cursorAtOpen !== emitter.cursor()) return;
    // The empty pre entity drops on close; reopen carrying the language
    emitter.closeEntity(top.handle);
    const spec: EntitySpec = { type: 'pre', language };
    top.spec = spec;
    top.handle = emitter.openEntity(spec);
    top.cursorAtOpen = emitter.cursor();
};

const closeFrame = (
    name: string,
    raw: string,
    emitter: Emitter,
    stack: HtmlTagFrame[]
): void => {
    const index = frameIndexFromTop(stack, name);
    if (index === -1) {
        // Stray close: drop known formatting tags, keep the rest literal
        if (!KNOWN_CLOSE_NAMES.has(name)) emitter.pushText(raw);
        return;
    }
    // Mismatched nesting recovery: close everything above the match
    // (innermost first), close the match, then reopen the rest so entity
    // ranges stay properly nested
    const reopened = stack.splice(index + 1);
    for (let above = reopened.length - 1; above >= 0; above -= 1) {
        const frame = reopened[above];
        if (frame?.handle) emitter.closeEntity(frame.handle);
    }
    const target = stack.pop();
    if (target?.handle) emitter.closeEntity(target.handle);
    for (const frame of reopened) {
        frame.handle = frame.spec ? emitter.openEntity(frame.spec) : null;
        frame.cursorAtOpen = emitter.cursor();
        stack.push(frame);
    }
};

/**
 * Render one raw html node value. The pairing stack lives in the walk
 * context so a tag opened in one inline node closes in a later sibling.
 */
export const renderHtmlValue = (
    value: string,
    emitter: Emitter,
    stack: HtmlTagFrame[]
): void => {
    const tokens = tokenizeHtml(value);
    tokens.forEach((token, index) => {
        if (token.kind === 'text') {
            let text = token.value;
            const previous = tokens[index - 1];
            const next = tokens[index + 1];
            // Markup whitespace between list tags (<ul>\n  <li>…) is layout,
            // not content — it would land before the item marker
            if (stack[stack.length - 1]?.list && text.trim() === '') return;
            // <pre> blocks carry the tags' own line breaks — keep the entity
            // free of an artificial blank first/last line
            if (previous?.kind === 'tag' && previous.name === 'pre' && !previous.closing) {
                text = text.replace(/^\n/, '');
            }
            if (next?.kind === 'tag' && next.name === 'pre' && next.closing) {
                text = text.replace(/\n$/, '');
            }
            emitter.pushText(text);
            return;
        }
        if (token.name === 'br') {
            emitter.pushText('\n');
            return;
        }
        if (token.closing) {
            closeFrame(token.name, token.raw, emitter, stack);
            return;
        }
        const meaning = classifyOpenTag(token.name, token.attrs);
        if (meaning.kind === 'literal') {
            emitter.pushText(token.raw);
            return;
        }
        // A self-closing formatting tag (<b/>) wraps nothing: no-op
        if (token.selfClosing) return;
        // Before the code frame goes on the stack the top is still the pre
        if (token.name === 'code') upgradePreLanguage(token.attrs, emitter, stack);
        openFrame(token.name, meaning, emitter, stack);
    });
};

/**
 * Flatten a raw html value to its visible text for contexts where entities
 * cannot apply (table cells): known tags strip away, <br> becomes a space
 * (cell layouts are single-line), unknown tags stay literal.
 */
export const strippedHtmlText = (value: string): string =>
    tokenizeHtml(value)
        .map((token) => {
            if (token.kind === 'text') return token.value;
            if (token.name === 'br') return ' ';
            if (token.closing) return KNOWN_CLOSE_NAMES.has(token.name) ? '' : token.raw;
            return classifyOpenTag(token.name, token.attrs).kind === 'literal' ? token.raw : '';
        })
        .join('');

/** Leniently close whatever is still open — called at every block end */
export const flushHtmlStack = (emitter: Emitter, stack: HtmlTagFrame[]): void => {
    while (stack.length > 0) {
        const frame = stack.pop();
        if (frame?.handle) emitter.closeEntity(frame.handle);
    }
};
