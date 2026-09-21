import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { fetchSuggestions, type Suggestion } from "./api";

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  work: "Paper",
  topic: "Topic",
  concept: "Concept",
};

interface Props {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onPick: (text: string) => void;
  children: ReactNode;
}

export function SuggestField({
  value,
  disabled,
  onChange,
  onPick,
  children,
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);

  useEffect(() => {
    if (disabled) {
      setItems([]);
      setOpen(false);
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    const my = ++seq.current;
    const timer = window.setTimeout(() => {
      void fetchSuggestions(q)
        .then((next) => {
          if (my !== seq.current) return;
          setItems(next);
          setActive(-1);
          setOpen(next.length > 0);
        })
        .catch(() => {
          if (my !== seq.current) return;
          setItems([]);
          setOpen(false);
        });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [value, disabled]);

  useEffect(() => {
    function onDocPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, []);

  function choose(text: string) {
    onChange(text);
    onPick(text);
    setOpen(false);
    setItems([]);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open || items.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((i) => (i + 1) % items.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
        break;
      case "Enter":
        if (active >= 0 && active < items.length) {
          event.preventDefault();
          choose(items[active].text);
        }
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        setActive(-1);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={wrapRef} className="suggest relative min-w-0 flex-1" onKeyDown={onKeyDown}>
      <div aria-autocomplete="list" aria-controls={listId} aria-expanded={open}>
        {children}
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="suggest-menu border-border bg-surface absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 m-0 max-h-72 list-none overflow-auto rounded-[calc(var(--radius)-2px)] border p-1 shadow-[0_12px_40px_oklch(0.35_0.03_250/0.14)]"
        >
          {items.map((item, index) => {
            const selected = index === active;
            return (
              <li key={item.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={
                    selected
                      ? "bg-surface-secondary flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left"
                      : "hover:bg-surface-secondary flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left"
                  }
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(item.text);
                  }}
                >
                  <span className="text-sm leading-snug font-medium">
                    {item.text}
                  </span>
                  <span className="text-muted flex items-center gap-2 text-xs">
                    <span className="text-accent/90 font-medium tracking-wide uppercase">
                      {KIND_LABEL[item.kind]}
                    </span>
                    {item.hint ? <span className="truncate">{item.hint}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
