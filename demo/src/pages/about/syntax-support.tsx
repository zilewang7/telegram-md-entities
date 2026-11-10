import { useI18n } from '../../i18n/i18n-context';
import type { MessageKey } from '../../i18n/messages';

interface SyntaxItem {
  readonly nameKey: MessageKey;
  /** Literal markdown sample, shown in mono; never translated */
  readonly sample: string;
}

const SYNTAX_ITEMS: readonly SyntaxItem[] = [
  { nameKey: 'about.syntax.bold', sample: '**x**' },
  { nameKey: 'about.syntax.italic', sample: '*x* / _x_' },
  { nameKey: 'about.syntax.underline', sample: '__x__' },
  { nameKey: 'about.syntax.strike', sample: '~~x~~' },
  { nameKey: 'about.syntax.spoiler', sample: '||x||' },
  { nameKey: 'about.syntax.code', sample: '`x`' },
  { nameKey: 'about.syntax.codeblock', sample: '```ts' },
  { nameKey: 'about.syntax.quote', sample: '> x' },
  { nameKey: 'about.syntax.details', sample: '<details>' },
  { nameKey: 'about.syntax.link', sample: '[文字](url)' },
  { nameKey: 'about.syntax.autolink', sample: 'https://…' },
  { nameKey: 'about.syntax.heading', sample: '# x' },
  { nameKey: 'about.syntax.table', sample: '| a | b |' },
  { nameKey: 'about.syntax.task', sample: '- [x]' },
  { nameKey: 'about.syntax.hr', sample: '---' },
  { nameKey: 'about.syntax.cjk', sample: '中文**“重点”**后' },
];

/** The markdown dialect the forward direction accepts, as scannable chips */
export const SyntaxSupport = () => {
  const { t } = useI18n();

  return (
    <section className="section">
      <div className="ab-section-head">
        <h2 className="section-title">{t('about.syntax.title')}</h2>
        <p className="hint">{t('about.syntax.intro')}</p>
      </div>
      <div className="card ab-syntax">
        <ul className="chip-row ab-syntax-list">
          {SYNTAX_ITEMS.map((item) => (
            <li key={item.nameKey} className="chip ab-syntax-item">
              <code className="ab-syntax-sample">{item.sample}</code>
              <span className="ab-syntax-name">{t(item.nameKey)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
