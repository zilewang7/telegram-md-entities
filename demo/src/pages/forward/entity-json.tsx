import { useMemo } from 'react';
import { Collapsible } from '../../components/collapsible';
import type { RenderedMarkdown } from '../../core/types';
import { useI18n } from '../../i18n/i18n-context';

interface EntityJsonProps {
  rendered: RenderedMarkdown;
}

/** Folded debug view: the exact text + entities payload the Bot API would receive */
export const EntityJson = ({ rendered }: EntityJsonProps) => {
  const { t } = useI18n();
  const json = useMemo(
    () => JSON.stringify({ text: rendered.text, entities: rendered.entities }, null, 2),
    [rendered]
  );
  const summary = useMemo(
    () =>
      t('forward.entities.summary', {
        entities: rendered.entities.length,
        chars: rendered.text.length,
      }),
    [rendered, t]
  );

  return (
    <div className="fw-entity-json">
      <Collapsible title={t('forward.entities.title')} summary={summary}>
        <pre className="code-block">{json}</pre>
      </Collapsible>
    </div>
  );
};
