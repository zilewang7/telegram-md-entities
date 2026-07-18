/**
 * Flatten mdast nodes to their plain visible text (no entities). Used where
 * formatting cannot apply: table cells inside a pre block, link labels for
 * autolink comparison, image alt fallbacks.
 */
import type { Node } from 'mdast';
import { strippedHtmlText } from './html-tags';

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

/** Like plainTextOfNode, but raw html strips to its visible text */
export const visibleTextOfNode = (node: Node): string => {
    if (node.type === 'html' && 'value' in node && typeof node.value === 'string') {
        return strippedHtmlText(node.value);
    }
    if ('children' in node && Array.isArray(node.children)) {
        return node.children.map(visibleTextOfNode).join('');
    }
    return plainTextOfNode(node);
};

export const visibleTextOfNodes = (nodes: Node[]): string =>
    nodes.map(visibleTextOfNode).join('');
