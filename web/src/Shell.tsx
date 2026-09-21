import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  plate?: string;
  trailing?: ReactNode;
  centered?: boolean;
}

export function Shell({ children, plate, trailing, centered = false }: Props) {
  const padX = centered
    ? "px-[max(1.25rem,env(safe-area-inset-left))] pe-[max(1.25rem,env(safe-area-inset-right))]"
    : "px-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] sm:px-[max(1.25rem,env(safe-area-inset-left))] sm:pe-[max(1.25rem,env(safe-area-inset-right))]";

  return (
    <div className="min-h-dvh">
      <header className="border-border/70 bg-surface/80 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className={`mx-auto flex min-h-14 w-full max-w-[72rem] items-center gap-2 ${padX} py-2 sm:gap-3`}>
          <p className="m-0 min-w-0 truncate text-[1.05rem] font-semibold tracking-tight">
            <span className="text-accent">OpenReach</span>
          </p>
          {plate ? (
            <>
              <span aria-hidden className="bg-border h-4 w-px shrink-0" />
              <p className="text-muted m-0 min-w-0 truncate text-sm">{plate}</p>
            </>
          ) : null}
          <div className="ms-auto flex shrink-0 items-center gap-2">{trailing}</div>
        </div>
      </header>
      <div
        className={
          centered
            ? `mx-auto flex w-full max-w-[40rem] flex-col ${padX} pt-[min(12vh,6rem)] pb-[max(6rem,env(safe-area-inset-bottom))] sm:pt-[min(18vh,8rem)]`
            : `mx-auto w-full max-w-[72rem] ${padX} py-4 pb-[max(6rem,env(safe-area-inset-bottom))] sm:pt-8`
        }
      >
        {children}
      </div>
    </div>
  );
}
