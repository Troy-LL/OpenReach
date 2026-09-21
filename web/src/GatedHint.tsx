import { Chip, Tooltip } from "@heroui/react";

function LockIcon() {
  return (
    <svg
      aria-hidden
      className="h-3.5 w-3.5"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        clipRule="evenodd"
        d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2V10a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function KeyLockedChip({ hint }: { hint: string }) {
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <span className="inline-flex">
          <Chip size="sm" variant="soft">
            <Chip.Label className="inline-flex items-center gap-1">
              <LockIcon />
              Needs TypeSafe key
            </Chip.Label>
          </Chip>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content>{hint}</Tooltip.Content>
    </Tooltip>
  );
}
