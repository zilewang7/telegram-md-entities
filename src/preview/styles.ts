/**
 * Telegram-like CSS for the HTML preview, visually calibrated against the
 * official web clients (Web A look, light theme): 16px Roboto-ish bubble,
 * #3390ec accents, code blocks with a language header, tinted quote blocks,
 * speckled spoilers with hover reveal.
 */
export const TELEGRAM_PREVIEW_CSS = `
.tg-message {
    box-sizing: border-box;
    max-width: 460px;
    padding: 8px 12px 9px;
    border-radius: 12px;
    background: #ffffff;
    color: #000000;
    font: 400 16px/1.3125 "Roboto", -apple-system, "Segoe UI", "Helvetica Neue",
        "PingFang SC", "Microsoft YaHei", sans-serif;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    box-shadow: 0 1px 2px rgba(16, 35, 47, 0.14);
}
.tg-message a {
    color: #3390ec;
    text-decoration: none;
}
.tg-message a:hover { text-decoration: underline; }
.tg-message code {
    font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 0.875em;
    color: #cc5747;
    background: rgba(112, 117, 121, 0.08);
    border-radius: 4px;
    padding: 1px 4px;
}
.tg-message pre {
    display: block;
    margin: 3px 0;
    padding: 0;
    background: rgba(112, 117, 121, 0.08);
    border-radius: 8px;
    overflow: hidden;
}
.tg-message pre .tg-pre-header {
    padding: 3px 10px;
    font-size: 13px;
    font-weight: 500;
    color: #3390ec;
    background: rgba(51, 144, 236, 0.12);
}
.tg-message pre code {
    display: block;
    padding: 6px 10px 7px;
    color: #000000;
    background: none;
    border-radius: 0;
    font-size: 0.875em;
    line-height: 1.4;
    overflow-x: auto;
}
.tg-message blockquote {
    position: relative;
    margin: 3px 0;
    padding: 4px 10px 4px 12px;
    border-radius: 6px;
    background: rgba(51, 144, 236, 0.1);
    font-size: 0.9375em;
}
.tg-message blockquote::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 3px 0 0 3px;
    background: #3390ec;
}
.tg-message blockquote.tg-expandable { padding-right: 26px; }
.tg-message blockquote.tg-expandable::after {
    content: "";
    position: absolute;
    right: 8px;
    bottom: 8px;
    width: 8px;
    height: 8px;
    border-right: 2px solid #3390ec;
    border-bottom: 2px solid #3390ec;
    transform: rotate(45deg);
}
.tg-message .tg-spoiler {
    border-radius: 4px;
    color: transparent;
    background-color: rgba(112, 117, 121, 0.9);
    background-image:
        radial-gradient(rgba(255, 255, 255, 0.35) 0.6px, transparent 0.6px),
        radial-gradient(rgba(0, 0, 0, 0.25) 0.6px, transparent 0.6px);
    background-size: 4px 4px, 5px 5px;
    background-position: 0 0, 2px 2px;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
}
.tg-message .tg-spoiler:hover {
    background-color: rgba(112, 117, 121, 0.08);
    background-image: none;
    color: inherit;
}
`;
