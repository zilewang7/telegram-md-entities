import { useMemo } from 'react';
import { Collapsible } from '../../components/collapsible';
import type { RenderedMarkdown } from '../../core/types';

interface EntityJsonProps {
  rendered: RenderedMarkdown;
}

/** Folded debug view: the exact text + entities payload the Bot API would receive */
export const EntityJson = ({ rendered }: EntityJsonProps) => {
  const json = useMemo(
    () => JSON.stringify({ text: rendered.text, entities: rendered.entities }, null, 2),
    [rendered]
  );

  return (
    <div className="fw-entity-json">
      <Collapsible
        title="text + entities"
        summary={`${rendered.entities.length} 个实体 · ${rendered.text.length} 字符`}
      >
        <pre className="code-block">{json}</pre>
      </Collapsible>
    </div>
  );
};
