/**
 * Telegram-like CSS for the HTML preview. Approximates the official
 * clients' entity rendering (Web A/K) closely enough for visual review.
 */
export const TELEGRAM_PREVIEW_CSS = `
.tg-message {
    box-sizing: border-box;
    max-width: 480px;
    padding: 10px 14px;
    border-radius: 14px;
    background: #ffffff;
    color: #000000;
    font: 15px/1.4 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
    white-space: pre-wrap;
    word-wrap: break-word;
    box-shadow: 0 1px 2px rgba(16, 35, 47, 0.15);
}
.tg-message a { color: #2678b6; text-decoration: none; }
.tg-message a:hover { text-decoration: underline; }
.tg-message code {
    font-family: "SF Mono", Menlo, Consolas, "Courier New", monospace;
    font-size: 0.9em;
    color: #c03d33;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 3px;
    padding: 0 3px;
}
.tg-message pre {
    margin: 4px 0;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 6px;
    overflow-x: auto;
}
.tg-message pre code {
    display: block;
    color: #000;
    background: none;
    padding: 0;
}
.tg-message blockquote {
    margin: 4px 0;
    padding: 2px 8px 2px 10px;
    border-left: 3px solid #2678b6;
    border-radius: 4px;
    background: rgba(38, 120, 182, 0.08);
}
.tg-message blockquote.tg-expandable { position: relative; padding-right: 22px; }
.tg-message blockquote.tg-expandable::after {
    content: "⌄";
    position: absolute;
    right: 6px;
    bottom: 2px;
    color: #2678b6;
    font-weight: bold;
}
.tg-message .tg-spoiler {
    background: rgba(0, 0, 0, 0.85);
    color: transparent;
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
}
.tg-message .tg-spoiler:hover { background: rgba(0, 0, 0, 0.08); color: inherit; }
`;
