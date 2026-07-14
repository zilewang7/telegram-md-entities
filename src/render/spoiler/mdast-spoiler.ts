/**
 * mdast layer for the spoiler extension: materializes micromark 'spoiler'
 * tokens as { type: 'spoiler', children } phrasing nodes.
 */
import type { CompileContext, Extension as FromMarkdownExtension, Token } from 'mdast-util-from-markdown';
import type { PhrasingContent, Parent } from 'mdast';

export interface Spoiler extends Parent {
    type: 'spoiler';
    children: PhrasingContent[];
}

declare module 'mdast' {
    interface PhrasingContentMap {
        spoiler: Spoiler;
    }
    interface RootContentMap {
        spoiler: Spoiler;
    }
}

export const spoilerFromMarkdown = (): FromMarkdownExtension => ({
    canContainEols: ['spoiler'],
    enter: {
        spoiler(this: CompileContext, token: Token): void {
            this.enter({ type: 'spoiler', children: [] }, token);
        },
    },
    exit: {
        spoiler(this: CompileContext, token: Token): void {
            this.exit(token);
        },
    },
});
