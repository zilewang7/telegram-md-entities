/**
 * Flatten mdast nodes to their plain visible text (no entities). Used where
 * formatting cannot apply: table cells inside a pre block, link labels for
 * autolink comparison, image alt fallbacks.
 */
import type { Node } from 'mdast';

export const plainTextOfNode = (node: Node): string => {
    if ('value' in node && typeof node.value === 'string') {
        return node.value;
    }
    if ('children' in node && Array.isArray(node.children)) {
        return node.children.map(plainTextOfNode).join('');
    }
    return '';
};

export const plainTextOfNodes = (nodes: Node[]): string =>
    nodes.map(plainTextOfNode).join('');
