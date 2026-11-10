import { useI18n } from '../i18n/i18n-context';

/** Language toggle in the header: shows the other language's name */
export const LocaleSwitch = () => {
  const { locale, toggleLocale, t } = useI18n();
  const label = locale === 'zh' ? 'EN' : '中文';

  return (
    <button
      type="button"
      className="locale-switch"
      title={t('app.locale.switch')}
      aria-label={t('app.locale.switch')}
      onClick={toggleLocale}
    >
      {label}
    </button>
  );
};
