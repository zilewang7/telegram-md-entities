import { RichText } from '../../components/rich-text';
import { useI18n } from '../../i18n/i18n-context';
import type { MessageKey } from '../../i18n/messages';

interface StepCopy {
  readonly titleKey: MessageKey;
  readonly bodyKey: MessageKey;
}

const STEPS: readonly StepCopy[] = [
  { titleKey: 'about.how.flavors.title', bodyKey: 'about.how.flavors.body' },
  { titleKey: 'about.how.clients.title', bodyKey: 'about.how.clients.body' },
  { titleKey: 'about.how.pipeline.title', bodyKey: 'about.how.pipeline.body' },
  { titleKey: 'about.how.local.title', bodyKey: 'about.how.local.body' },
];

/** The clipboard mechanics behind both directions, in four short steps */
export const HowItWorks = () => {
  const { t } = useI18n();

  return (
    <section className="section">
      <div className="ab-section-head">
        <h2 className="section-title">{t('about.how.title')}</h2>
      </div>
      <ol className="ab-steps">
        {STEPS.map((step, index) => (
          <li key={step.titleKey} className="ab-step">
            <span className="ab-step-index" aria-hidden="true">
              {index + 1}
            </span>
            <div className="ab-step-body">
              <h3 className="ab-step-title">{t(step.titleKey)}</h3>
              <p className="ab-step-text">
                <RichText text={t(step.bodyKey)} />
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
