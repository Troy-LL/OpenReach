import { Button } from "@heroui/react";

interface Props {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: Props) {
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      aria-label="Results pages"
      className="border-border mt-6 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-4 md:mt-8 md:gap-3 md:pt-5"
    >
      <p className="text-muted m-0 text-sm tabular-nums">
        {from}–{to} of {totalItems}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          aria-label="Previous page"
          className="pressable min-h-11"
          isDisabled={!canPrev}
          size="sm"
          variant="secondary"
          onPress={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <p className="text-muted m-0 min-w-0 text-center text-sm tabular-nums">
          {page} / {totalPages}
        </p>
        <Button
          aria-label="Next page"
          className="pressable min-h-11"
          isDisabled={!canNext}
          size="sm"
          variant="secondary"
          onPress={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
