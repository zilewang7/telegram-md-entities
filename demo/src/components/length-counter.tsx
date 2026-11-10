interface LengthCounterProps {
  length: number;
  max: number;
}

/** "123 / 4096" with an over-limit colour; Telegram splits anything longer */
export const LengthCounter = ({ length, max }: LengthCounterProps) => (
  <span className={length > max ? 'length-counter over' : 'length-counter'}>
    {length} / {max}
  </span>
);
