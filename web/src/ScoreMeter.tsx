interface Props {
  label: string;
  value: number;
  max?: number;
  display: string;
  justification?: string;
}

export function ScoreMeter({
  label,
  value,
  max = 1,
  display,
  justification,
}: Props) {
  const ratio = Math.min(1, Math.max(0, value / max));

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[minmax(0,5.5rem)_1fr_2.6rem] items-center gap-2 sm:grid-cols-[6.5rem_1fr_2.6rem]">
        <span className="text-muted text-xs">{label}</span>
        <div
          aria-hidden
          className="bg-surface-secondary h-1.5 overflow-hidden rounded-sm"
        >
          <div
            className="meter-fill bg-accent h-full rounded-sm"
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>
        <span className="font-mono text-right text-xs tabular-nums">{display}</span>
      </div>
      {justification ? (
        <p className="text-muted m-0 min-w-0 pl-0 text-xs text-pretty leading-snug sm:pl-[6.5rem]">
          {justification}
        </p>
      ) : null}
    </div>
  );
}
