import { Skeleton } from "@heroui/react";
import type { ReactNode } from "react";

function Bone({ className }: { className: string }) {
  return <Skeleton animationType="shimmer" className={`rounded-sm ${className}`} />;
}

export function BootSkeleton() {
  return (
    <ShellFrame plate="boot">
      <div aria-hidden className="mx-auto flex max-w-[40rem] flex-col items-center gap-5 pt-[min(18vh,8rem)]">
        <Bone className="h-10 w-24" />
        <Bone className="h-4 w-[min(28rem,90%)]" />
        <Bone className="h-4 w-[min(22rem,75%)]" />
        <div className="search-shell mt-2 w-full p-4">
          <Bone className="h-12 w-full" />
        </div>
      </div>
    </ShellFrame>
  );
}

export function SearchSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading papers" className="flex flex-col gap-4" role="status">
      {Array.from({ length: 4 }, (_, index) => (
        <PaperSkeleton key={index} />
      ))}
    </div>
  );
}

export function FilterSkeleton() {
  return (
    <div aria-hidden className="plate flex flex-col gap-4 p-4">
      <Bone className="h-5 w-24" />
      <Bone className="h-10 w-full" />
      <Bone className="h-10 w-full" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-full" />
      <Bone className="h-16 w-full" />
    </div>
  );
}

export function PaperSkeleton() {
  return (
    <article className="plate p-5">
      <Bone className="mb-3 h-3 w-32" />
      <Bone className="mb-2 h-6 w-11/12" />
      <Bone className="mb-5 h-6 w-2/3" />
      <Bone className="mb-2 h-3.5 w-full" />
      <Bone className="mb-2 h-3.5 w-full" />
      <Bone className="mb-5 h-3.5 w-4/5" />
      <ScoreSkeleton />
    </article>
  );
}

export function ScoreSkeleton() {
  return (
    <div aria-label="Jev is scoring this paper" className="flex flex-col gap-2" role="status">
      <Bone className="h-2 w-full" />
      <Bone className="h-2 w-5/6" />
      <Bone className="h-2 w-3/4" />
    </div>
  );
}

function ShellFrame({ children, plate }: { children: ReactNode; plate: string }) {
  return (
    <div className="min-h-dvh">
      <header className="border-border/70 bg-surface/80 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[72rem] items-center gap-3 px-5">
          <Bone className="h-4 w-10" />
          <Bone className="h-4 w-28" />
          <span className="figure ms-auto">{plate}</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[72rem] px-5 py-8">{children}</div>
    </div>
  );
}
