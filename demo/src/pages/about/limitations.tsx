import { RichText } from '../../components/rich-text';
import { useI18n } from '../../i18n/i18n-context';
import type { MessageKey } from '../../i18n/messages';

const LIMIT_KEYS: readonly MessageKey[] = [
  'about.limits.ios',
  'about.limits.macos',
  'about.limits.tdesktop',
  'about.limits.android',
  'about.limits.quote',
  'about.limits.table',
];

/** The honest limits: most of them come from the clients, not the converter */
export const KnownLimitations = () => {
  const { t } = useI18n();

  return (
    <section className="section">
      <div className="ab-section-head">
        <h2 className="section-title">{t('about.limits.title')}</h2>
        <p className="hint">{t('about.limits.intro')}</p>
      </div>
      <ul className="card ab-limits">
        {LIMIT_KEYS.map((key) => (
          <li key={key} className="ab-limit">
            <RichText text={t(key)} />
          </li>
        ))}
      </ul>
    </section>
  );
};
