"use client";

import { useEffect, useRef, useState, type FC } from "react";
import { cn } from "@/lib/utils";
import type { TocEntry } from "@/app/lib/blog/render";

const TableOfContents: FC<{ entries: TocEntry[]; className?: string }> = ({ entries, className }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const visible = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (entries.length < 2) return;
    const headings = entries.map((e) => document.getElementById(e.id)).filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const order = new Map(entries.map((e, i) => [e.id, i]));
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting) visible.current.add(record.target.id);
          else visible.current.delete(record.target.id);
        }
        let best: string | null = null;
        for (const id of visible.current) {
          if (best === null || (order.get(id) ?? 0) < (order.get(best) ?? 0)) best = id;
        }
        setActiveId((prev) => (best === null ? prev : best === prev ? prev : best));
      },
      { rootMargin: "-88px 0px -55% 0px", threshold: 0 },
    );
    for (const h of headings) observer.observe(h);
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length < 2) return null;

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav aria-label="In this guide" className={cn("not-prose", className)}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary/45">In this guide</p>
      <ol className="relative mt-3">
        <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-px bg-primary/15" />
        {entries.map((e) => {
          const active = activeId === e.id;
          return (
            <li key={e.id} className={cn("relative", e.level === 3 && "ml-4")}>
              <button
                type="button"
                onClick={() => jumpTo(e.id)}
                aria-current={active ? "true" : undefined}
                className="group flex w-full items-start gap-3 py-1.5 text-left cursor-pointer">
                <span aria-hidden className="relative mt-[7px] flex h-[11px] w-[11px] flex-none items-center justify-center">
                  <span
                    className={cn(
                      "block rounded-full border-2 border-primary transition-all duration-200",
                      active ? "h-[11px] w-[11px] bg-secondary" : "h-[7px] w-[7px] bg-white group-hover:bg-secondary2",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "text-sm leading-snug transition-colors",
                    active ? "font-bold text-primary" : "font-medium text-primary/60 group-hover:text-primary",
                  )}>
                  {e.text}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default TableOfContents;
