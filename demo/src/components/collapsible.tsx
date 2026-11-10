import type { ReactNode } from 'react';

interface CollapsibleProps {
  title: string;
  /** Right-aligned one-liner shown next to the title */
  summary?: string | null;
  children: ReactNode;
}

/** Native <details> disclosure: no state, keyboard-accessible, prints fine */
export const Collapsible = ({ title, summary = null, children }: CollapsibleProps) => (
  <details className="collapsible">
    <summary>
      {title}
      {summary !== null && <span className="collapsible-summary">{summary}</span>}
    </summary>
    <div className="collapsible-body">{children}</div>
  </details>
);
