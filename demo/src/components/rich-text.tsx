import { Fragment, useMemo } from 'react';

interface RichTextProps {
  text: string;
}

/**
 * Renders `code` spans from a dictionary string without interpreting HTML:
 * alternate segments split on backticks are wrapped in <code>.
 */
export const RichText = ({ text }: RichTextProps) => {
  const parts = useMemo(() => text.split('`'), [text]);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code key={index}>{part}</code>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
};
