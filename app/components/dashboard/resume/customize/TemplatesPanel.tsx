"use client";

import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumeDesign } from "../useResumeDesign";
import { TEMPLATE_OPTIONS } from "@/app/lib/dashboard/resume/templates";
import { DEFAULT_DESIGN } from "@/app/lib/dashboard/resume/design-defaults";

/**
 * The 6-template gallery as a horizontal carousel. Each card is a live
 * button: clicking dispatches `template/apply`, which replaces
 * `design`/`sections` wholesale as ONE undo-history entry (see
 * `design-reducer.ts`'s comment above `snapshotReducer`'s `"template/apply"`
 * case) — so an accidental click is one Undo away from being fully reverted,
 * and no confirmation dialog is warranted.
 *
 * Cards are 45% of the rail, so it shows two with the next one peeking. The
 * previous/next buttons sit side by side under the track, centred (owner,
 * 2026-10-08), and step one card at a time; touch swipes the track, and
 * keyboard focus scrolls a card into view on its own. A card's name shows as
 * a label on it while it is hovered or focused; there is no name or blurb
 * under the carousel.
 *
 * `lastAppliedId` is deliberately NOT a read of live design state — the
 * architecture never lets applied-template identity leak back into
 * `ResumeDesign` (that's the fix for the old screen's `classic`-template
 * permanently overriding the Font control; see `lookupTemplate`'s comment
 * in `design-reducer.ts`). So there is nothing to select a highlighted card
 * from once the user has touched Colors, Font, etc. — even a deep-equality
 * check against every template's merged design would be misleading more
 * often than not. It is honestly just "the last card clicked while this
 * resume is open," kept beside the design as an editor mark so Undo takes
 * the tick back with the template. Seeded to "atlas" because a fresh
 * document's design is exactly `DEFAULT_DESIGN`/`DEFAULT_SECTIONS` and
 * Atlas's own diff is `{}` — so on a fresh document that really is the
 * active template.
 */
const TemplatesPanel: FC = () => {
  const { dispatch, marks } = useResumeDesign();
  const lastAppliedId = marks.template;
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  const trackRef = useRef<HTMLDivElement>(null);

  const readEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdges((prev) => (prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd }));
  }, []);

  // A ResizeObserver reports once as soon as it starts watching, which takes the first reading too.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(readEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [readEdges]);

  const behavior = (): ScrollBehavior =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  /** One card (plus the gap) per press; snapping lands it on the card's edge. */
  const step = (dir: -1 | 1) => {
    const el = trackRef.current;
    const card = el?.firstElementChild;
    if (!el || !(card instanceof HTMLElement)) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: behavior() });
  };

  // Outlined, no press: they stay put, and fade at the end they can't go past.
  const arrow =
    "grid h-8 w-8 cursor-pointer place-content-center rounded-full border border-[#222325] bg-white text-primary transition-opacity duration-150 disabled:cursor-default disabled:opacity-30";

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        role="group"
        aria-label="Templates"
        onScroll={readEdges}
        className="-mx-1 flex snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TEMPLATE_OPTIONS.map((tpl) => {
          const selected = tpl.id === lastAppliedId;
          return (
            <button
              key={tpl.id}
              type="button"
              aria-label={`${tpl.name} template`}
              aria-pressed={selected}
              onClick={(e) => {
                dispatch({ type: "template/apply", id: tpl.id });
                e.currentTarget.scrollIntoView({ behavior: behavior(), block: "nearest", inline: "nearest" });
              }}
              className={cn(
                "group/card relative w-[45%] flex-none snap-start rounded-xl bg-white text-left",
                selected ? "border-2 br-shadow br-lime" : "br-plain-press"
              )}>
              <span className="block overflow-hidden rounded-[10px]">
                <tpl.Thumb accent={tpl.design.colors?.accent ?? DEFAULT_DESIGN.colors.accent} />
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-2 left-2 rounded-full border border-[#222325] bg-white px-2 py-0.5 text-[11px] font-bold text-primary opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 group-focus-visible/card:opacity-100">
                {tpl.name}
              </span>
              {selected && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-content-center rounded-full bg-[#222325] text-[#e1f073]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center gap-2">
        <button type="button" tabIndex={-1} aria-label="Previous templates" disabled={edges.atStart} onClick={() => step(-1)} className={arrow}>
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <button type="button" tabIndex={-1} aria-label="Next templates" disabled={edges.atEnd} onClick={() => step(1)} className={arrow}>
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-black/45">
        Applying a template is one undo away if you change your mind.
      </p>
    </div>
  );
};

export default TemplatesPanel;
