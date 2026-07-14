/**
 * micromark syntax extension for Telegram's ||spoiler|| dialect.
 * Modeled on micromark-extension-gfm-strikethrough's attention mechanism:
 * a tokenizer collects `||` runs and marks open/close ability via character
 * classification; a resolveAll pass pairs them up and wraps the span.
 */
import { splice } from 'micromark-util-chunked';
import { classifyCharacter } from 'micromark-util-classify-character';
import { resolveAll } from 'micromark-util-resolve-all';
import type {
    Code,
    Event,
    Extension,
    Resolver,
    State,
    Token,
    TokenizeContext,
    Tokenizer,
} from 'micromark-util-types';

declare module 'micromark-util-types' {
    interface TokenTypeMap {
        spoiler: 'spoiler';
        spoilerSequence: 'spoilerSequence';
        spoilerSequenceTemporary: 'spoilerSequenceTemporary';
        spoilerText: 'spoilerText';
    }
}

const VERTICAL_BAR = 124; // '|'

const resolveAllSpoiler: Resolver = (events, context) => {
    let index = -1;

    while (++index < events.length) {
        const closeEvent = events[index];
        if (
            closeEvent?.[0] === 'enter' &&
            closeEvent[1].type === 'spoilerSequenceTemporary' &&
            closeEvent[1]._close
        ) {
            let open = index;
            while (open--) {
                const openEvent = events[open];
                if (
                    openEvent?.[0] === 'exit' &&
                    openEvent[1].type === 'spoilerSequenceTemporary' &&
                    openEvent[1]._open
                ) {
                    // Found the opener: promote both sequences and wrap
                    closeEvent[1].type = 'spoilerSequence';
                    openEvent[1].type = 'spoilerSequence';

                    const spoiler: Token = {
                        type: 'spoiler',
                        start: { ...openEvent[1].start },
                        end: { ...closeEvent[1].end },
                    };
                    const text: Token = {
                        type: 'spoilerText',
                        start: { ...openEvent[1].end },
                        end: { ...closeEvent[1].start },
                    };

                    const nextEvents: Event[] = [
                        ['enter', spoiler, context],
                        ['enter', openEvent[1], context],
                        ['exit', openEvent[1], context],
                        ['enter', text, context],
                    ];

                    const insideSpan = context.parser.constructs.insideSpan.null;
                    if (insideSpan) {
                        splice(
                            nextEvents,
                            nextEvents.length,
                            0,
                            resolveAll(insideSpan, events.slice(open + 1, index), context)
                        );
                    }

                    splice(nextEvents, nextEvents.length, 0, [
                        ['exit', text, context],
                        ['enter', closeEvent[1], context],
                        ['exit', closeEvent[1], context],
                        ['exit', spoiler, context],
                    ]);

                    splice(events, open - 1, index - open + 3, nextEvents);
                    index = open + nextEvents.length - 2;
                    break;
                }
            }
        }
    }

    // Downgrade unpaired sequences to plain data
    index = -1;
    while (++index < events.length) {
        const event = events[index];
        if (event && event[1].type === 'spoilerSequenceTemporary') {
            event[1].type = 'data';
        }
    }

    return events;
};

const tokenizeSpoiler: Tokenizer = function (this: TokenizeContext, effects, ok, nok) {
    const previous = this.previous;
    const events = this.events;
    let size = 0;

    const more: State = (code: Code) => {
        const before = classifyCharacter(previous);

        if (code === VERTICAL_BAR) {
            // At most '||' — a third bar kills the construct
            if (size > 1) return nok(code);
            effects.consume(code);
            size += 1;
            return more;
        }

        if (size < 2) return nok(code);

        const token = effects.exit('spoilerSequenceTemporary');
        const after = classifyCharacter(code);
        token._open = !after || (after === 2 && Boolean(before));
        token._close = !before || (before === 2 && Boolean(after));
        return ok(code);
    };

    const start: State = (code: Code) => {
        const lastEvent = events[events.length - 1];
        if (
            previous === VERTICAL_BAR &&
            lastEvent &&
            lastEvent[1].type !== 'characterEscape'
        ) {
            return nok(code);
        }
        effects.enter('spoilerSequenceTemporary');
        return more(code);
    };

    return start;
};

export const spoilerSyntax = (): Extension => ({
    text: {
        [VERTICAL_BAR]: {
            name: 'spoiler',
            tokenize: tokenizeSpoiler,
            resolveAll: resolveAllSpoiler,
        },
    },
    insideSpan: {
        null: [{ resolveAll: resolveAllSpoiler }],
    },
    attentionMarkers: { null: [VERTICAL_BAR] },
});
