import { RichText } from '../../components/rich-text';
import { useI18n } from '../../i18n/i18n-context';
import type { MessageKey } from '../../i18n/messages';

const GITHUB_URL = 'https://github.com/zilewang7/telegram-md-entities';
const NPM_URL = 'https://www.npmjs.com/package/telegram-md-entities';

const FEATURE_KEYS: readonly MessageKey[] = [
  'about.library.capability.split',
  'about.library.capability.streaming',
  'about.library.capability.preview',
  'about.library.capability.reverse',
];

const INSTALL_COMMAND = 'npm install telegram-md-entities';

const MINIMAL_EXAMPLE = `import { renderMarkdown } from 'telegram-md-entities';

const { text, entities } = renderMarkdown('**hi**');
await bot.api.sendMessage(chatId, text, { entities });`;

/** What the library does, where to get it, and the smallest possible usage */
export const LibraryIntro = () => {
  const { t } = useI18n();

  return (
    <section className="section">
      <div className="ab-section-head">
        <h2 className="section-title">{t('about.library.title')}</h2>
        <p className="hint">{t('about.library.intro')}</p>
      </div>
      <div className="card ab-library">
        <p className="ab-library-text">
          <RichText text={t('about.library.body')} />
        </p>
        <div className="chip-row">
          {FEATURE_KEYS.map((key) => (
            <span key={key} className="chip">
              {t(key)}
            </span>
          ))}
        </div>
        <div className="ab-library-links">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            {t('about.library.link.github')}
          </a>
          <a href={NPM_URL} target="_blank" rel="noreferrer">
            {t('about.library.link.npm')}
          </a>
        </div>
        <div className="field-group">
          <span className="field-label">{t('about.library.install')}</span>
          <pre className="code-block">
            <code>{INSTALL_COMMAND}</code>
          </pre>
        </div>
        <div className="field-group">
          <span className="field-label">{t('about.library.example')}</span>
          <pre className="code-block">
            <code>{MINIMAL_EXAMPLE}</code>
          </pre>
        </div>
      </div>
    </section>
  );
};
