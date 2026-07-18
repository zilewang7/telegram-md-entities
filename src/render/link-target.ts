/**
 * text_link url policy: the server silently DROPS entities whose url is not
 * http(s)/tg (observed live: mailto links vanish from sent messages) — only
 * emit entities for schemes Telegram keeps; www. gets https:// prefixed;
 * everything else degrades to plain text.
 */
export const resolveLinkTarget = (url: string): string | null => {
    if (/^(https?|tg):/i.test(url)) return url;
    if (/^www\./i.test(url)) return `https://${url}`;
    return null;
};
