import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  plate?: string;
  trailing?: ReactNode;
  centered?: boolean;
}

export function Shell({ children, plate, trailing, centered = false }: Props) {
  return (
    <div className="min-h-dvh">
      <header className="border-border/70 bg-surface/80 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[72rem] items-center gap-3 px-5">
          <p className="m-0 text-[1.05rem] font-semibold tracking-tight">
            <span className="text-accent">OpenReach</span>
          </p>
          {plate ? (
            <>
              <span aria-hidden className="bg-border h-4 w-px" />
              <p className="text-muted m-0 text-sm">{plate}</p>
            </>
          ) : null}
          <div className="ms-auto flex items-center gap-2">{trailing}</div>
        </div>
      </header>
      <div
        className={
          centered
            ? "mx-auto flex w-full max-w-[40rem] flex-col px-5 pt-[min(18vh,8rem)] pb-24"
            : "mx-auto w-full max-w-[72rem] px-5 py-8 pb-24"
        }
      >
        {children}
      </div>
    </div>
  );
}
