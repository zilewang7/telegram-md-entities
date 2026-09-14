/**
 * Tier-2 e2e for the shape that broke a live bot (2026-09-14): a long LLM
 * "thinking" block whose nested bullets are indented by four spaces, so
 * markdown reads them as an indented code block.
 *
 * The API happily accepts a `pre` nested inside a quote (see the corpus
 * gallery) — clients do not: they stop rendering the quote at the first
 * nested block and the thinking text leaks into the message body. So the
 * assertion here is the compose contract, end to end: what we send is what
 * the server returns, and it holds no block entity inside the quote.
 */
import { describe, expect, it } from 'vitest';
import { renderMarkdown, validateMessage, wrapInBlockquote } from '../../src/index';
import { createClient } from './helpers/client';
import { readE2eEnv } from './helpers/env';
import { fromResponse, normalizeForCompare } from './helpers/normalize';

const env = readE2eEnv();

/** Trimmed from the real incident CoT: headings, a paragraph, then the trap */
const THINKING = `**Focusing on Incoming Data**

I'm currently processing the initial input, specifically the mention of Azusa and the bot it summoned.

**Analyzing the Azusa Command**

Thoughts:

This is a good start! The next steps should involve understanding the core action.

1.  **Determine the Bot's Core Function:** Based on the "Role" provided, the bot's primary function is to reply to the summon.

2.  **Interpret the mention:** I need to confirm that the cat emoji is indeed the trigger.

Essentially, I'm piecing together a puzzle:
*   **Who summoned?** Azusa
*   **What triggered the summon?** A link preview.
*   **What should the bot do?** Reply.

My immediate focus is on verifying the meaning of the trigger, as this seems to be the core of the information provided.
    *   **Re-evaluation of the phrase:** The interpretation might be more direct than "posted a new tweet."

    *   **Linking to Surname Context:** The link preview is about a rare surname.
        *   The post itself is key. It "wants to be a cat."
        *   My immediate task is to identify the exact content of that post.

**Finalizing Reply Content**

I am concentrating on the final content of the bot's reply, in Chinese, with emojis.`;

describe.skipIf(!env)('e2e thinking quote', () => {
    const client = env ? createClient(env) : null;

    it('round-trips a CoT quote with no nested block entity', async () => {
        if (!client) return;

        // The trap is real: the bare render does produce an indented code block
        const bare = renderMarkdown(THINKING);
        expect(bare.entities.filter((entity) => entity.type === 'pre')).not.toEqual([]);

        const wrapped = wrapInBlockquote(bare, true);
        expect(validateMessage(wrapped)).toEqual([]);
        expect(wrapped.entities.filter((entity) => entity.type === 'pre')).toEqual([]);

        const response = await client.sendMessage({
            text: wrapped.text,
            entities: wrapped.entities,
        });
        console.log(`  thinking quote: ${client.messageLink(response.message_id)}`);

        expect(normalizeForCompare(fromResponse(response))).toEqual(normalizeForCompare(wrapped));

        await client.maybeCleanup(response.message_id);
    });
});
