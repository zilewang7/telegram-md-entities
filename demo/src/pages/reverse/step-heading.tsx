interface StepHeadingProps {
  index: number;
  title: string;
  hint?: string;
}

/** Numbered heading that gives the panel its 1-2-3 flow */
export const StepHeading = ({ index, title, hint }: StepHeadingProps) => (
  <div className="rv-step-head">
    <span className="rv-step-index" aria-hidden="true">
      {index}
    </span>
    <div className="rv-step-copy">
      <h2 className="rv-step-title">{title}</h2>
      {hint !== undefined && <p className="rv-step-hint">{hint}</p>}
    </div>
  </div>
);
