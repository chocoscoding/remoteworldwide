"use client";

// "Missing from your resume": every gap the score found, as chips (owner, 2026-10-03).
//
// Hovering a chip (or focusing it) shows what that gap needs in a small dark
// card; clicking picks it. The picked ones are listed underneath in a compact
// summary: one line each, a lighter dark than the page's ink because it is
// secondary, no taller than about 100px however many are picked (it scrolls),
// and any line opens, one at a time. One button works all the picked ones in
// with the AI for a single credit, rather than a credit each.
//
// Little text at once (owner: "your eyes are going everywhere ... let users
// flow through the UI"): the closest line is one sentence, quantities sit in
// pills, and the steps are pills; in the summary, picking a pill says how, one
// at a time. What to do is written from the scan itself and costs nothing
// (`stepsForGap`).

import { useEffect, useRef, useState, type FC } from "react";
import { Check, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { INTERVIEW_ADVICE_LABEL, stepsForGap, type GapSteps } from "@/app/lib/apply/gapSteps";
import { quantityParts } from "@/app/lib/apply/score";
import type { AtsKeyword, RequirementVerdict } from "@/app/lib/ats/types";
import { SUGGESTION_CREDITS } from "@/app/lib/resume/ai";
import { cn } from "@/lib/utils";

/** A chip's label is a window on the requirement: one that stops short of its end gets an ellipsis. */
const stopsShort = (label: string, requirement: string) => {
  const end = (text: string) => text.trim().replace(/[.;:,\s]+$/, "");
  return !end(requirement).endsWith(end(label));
};

/** Hover intent: how long the pointer rests before a card opens, and how long it may be away before it closes. */
const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 120;

/** Text with its quantities ("5+ years", "40%") in small lime pills. */
const WithQuantities: FC<{ text: string }> = ({ text }) => (
  <>
    {quantityParts(text).map((part, index) =>
      part.quantity ? (
        <span key={index} className="mx-px whitespace-nowrap rounded-full bg-[#e1f073] px-1.5 py-px text-[0.92em] font-semibold text-primary">
          {part.text}
        </span>
      ) : (
        <span key={index}>{part.text}</span>
      ),
    )}
  </>
);

/** A small outlined pill on the dark cards. */
const Tag: FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className, title }) => (
  <span
    title={title}
    className={cn("inline-flex max-w-full items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-semibold text-white/75", className)}>
    {children}
  </span>
);

/**
 * What one gap needs, kept short: the closest line (one sentence, with whose it is), the steps as
 * pills, and the advice when nothing came close. In the summary the pills open, one at a time, to
 * say how; on the hover card they carry it as a tooltip.
 */
const GapDetail: FC<{ help: GapSteps; interactive: boolean }> = ({ help, interactive }) => {
  const [shown, setShown] = useState(0);
  const active = interactive ? help.actions[shown] : null;
  return (
    <div className="flex flex-col gap-3">
      {help.closest && (
        <div className="flex flex-col gap-1.5">
          {help.closest.role && <Tag className="self-start">On your resume · {help.closest.role}</Tag>}
          <p className="line-clamp-3 border-l-2 border-[#e1f073]/60 pl-3 text-[13px] leading-relaxed text-white/70">
            “<WithQuantities text={help.closest.text} />”
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {help.actions.map((action, index) =>
          interactive ? (
            <button
              key={action.label}
              type="button"
              aria-pressed={index === shown}
              onClick={() => setShown(index)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors",
                index === shown ? "border-[#e1f073] bg-[#e1f073] text-primary" : "border-white/20 text-white/80 hover:border-white/45 hover:text-white",
              )}>
              <span className={cn("tabular-nums", index === shown ? "text-primary/60" : "text-[#e1f073]")}>{index + 1}</span>
              {action.label}
            </button>
          ) : (
            <Tag key={action.label} title={action.how} className="py-1 text-[12px] text-white/85">
              <span className="tabular-nums text-[#e1f073]">{index + 1}</span>
              {action.label}
            </Tag>
          ),
        )}
        {help.advice && (
          <Tag title={help.advice} className="border-dashed border-[#e1f073]/50 py-1 text-[12px] text-[#e1f073]">
            {INTERVIEW_ADVICE_LABEL}
          </Tag>
        )}
      </div>
      {active && <p className="text-[13px] leading-relaxed text-white/75">{active.how}</p>}
    </div>
  );
};

export interface GapPickerProps {
  gaps: AtsKeyword[];
  verdictById: ReadonlyMap<string, RequirementVerdict>;
  /** Works the picked gaps in, one credit for all of them; true once a proposal is in. Absent while the tools can't run. */
  onFix?: (labels: string[]) => Promise<boolean>;
  fixing: boolean;
  /** Why the last fix started here failed, said beside its button. */
  fixError?: string | null;
}

const GapPicker: FC<GapPickerProps> = ({ gaps, verdictById, onFix, fixing, fixError = null }) => {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());

  // A gap the latest score no longer lists can't stay picked, or open.
  const chosen = gaps.filter((gap) => picked.has(gap.id));
  const opened = chosen.some((gap) => gap.id === openId) ? openId : null;

  const helpFor = (gap: AtsKeyword): GapSteps | null => {
    const verdict = verdictById.get(gap.id);
    return verdict ? stepsForGap(verdict, gap.label) : null;
  };

  // ---- Hover cards ----------------------------------------------------------------------------
  const clearTimer = (timer: { current: number | null }) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      clearTimer(openTimer);
      clearTimer(closeTimer);
    },
    [],
  );

  function showCard(id: string) {
    clearTimer(closeTimer);
    clearTimer(openTimer);
    // Moving from one chip to the next swaps the card at once; a first card waits for the pointer to settle.
    if (hovered !== null) setHovered(id);
    else openTimer.current = window.setTimeout(() => setHovered(id), OPEN_DELAY_MS);
  }

  function hideCard() {
    clearTimer(openTimer);
    clearTimer(closeTimer);
    closeTimer.current = window.setTimeout(() => setHovered(null), CLOSE_DELAY_MS);
  }

  // ---- Picking ---------------------------------------------------------------------------------
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function openRow(id: string) {
    const next = opened === id ? null : id;
    setOpenId(next);
    if (next) requestAnimationFrame(() => rows.current.get(next)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  function fix() {
    if (!onFix || chosen.length === 0) return;
    // The picks stay until the proposal is in: a failed run keeps them for another try.
    void onFix(chosen.map((gap) => gap.label)).then((made) => {
      if (!made) return;
      setPicked(new Set());
      setOpenId(null);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-base font-bold text-primary">Missing from your resume</p>
        <div className="flex items-center gap-3 text-xs font-bold">
          <button
            type="button"
            onClick={() => setPicked(new Set(gaps.map((gap) => gap.id)))}
            className="cursor-pointer text-primary underline decoration-2 underline-offset-4">
            Pick all {gaps.length}
          </button>
          {chosen.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setPicked(new Set());
                setOpenId(null);
              }}
              className="cursor-pointer text-black/50 underline decoration-2 underline-offset-4">
              Clear
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-black/55">Hover one to see what it needs. Pick the ones to fix.</p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {gaps.map((gap) => {
          const on = picked.has(gap.id);
          const help = helpFor(gap);
          const requirement = help?.requirement ?? gap.label;
          return (
            <Popover key={gap.id} open={hovered === gap.id} onOpenChange={(open) => !open && setHovered(null)}>
              <PopoverAnchor asChild>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(gap.id)}
                  onPointerEnter={() => showCard(gap.id)}
                  onPointerLeave={hideCard}
                  onFocus={() => showCard(gap.id)}
                  onBlur={hideCard}
                  className={cn(
                    "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[13px] font-semibold transition-colors",
                    on ? "border-[#222325] bg-[#e1f073] text-primary" : "border-dashed border-black/25 bg-white text-black/70 hover:border-[#222325] hover:text-primary",
                  )}>
                  {on && <Check className="h-3.5 w-3.5 flex-none" strokeWidth={3} aria-hidden />}
                  <span className="truncate">
                    {gap.label}
                    {stopsShort(gap.label, requirement) && "…"}
                  </span>
                </button>
              </PopoverAnchor>
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={8}
                collisionPadding={16}
                // A card that follows the pointer: it never takes focus from the chips, or gives it back.
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
                onPointerEnter={() => clearTimer(closeTimer)}
                onPointerLeave={hideCard}
                // As wide as the screen allows, up to a comfortable measure: long requirements read in a few lines.
                className="br-shadow br-lime w-[clamp(300px,42vw,560px)] max-w-[calc(100vw-32px)] rounded-xl border-[#222325] bg-[#222325] p-4 text-left text-white">
                <div className="flex flex-wrap gap-1.5">
                  <Tag className={help?.weight === "Required" ? "border-[#e1f073]/50 text-[#e1f073]" : undefined}>{help?.weight ?? "From the posting"}</Tag>
                  {help && <Tag>{help.status === "partial" ? "Partly covered" : "Not on your resume yet"}</Tag>}
                </div>
                <p className="mb-3 mt-2 text-sm font-medium leading-snug text-white">
                  <WithQuantities text={requirement} />
                </p>
                {help ? (
                  <GapDetail help={help} interactive={false} />
                ) : (
                  <p className="text-[13px] leading-relaxed text-white/75">Say it plainly in a bullet or in your skills, in the posting&apos;s words.</p>
                )}
                <p className="mt-3 border-t border-white/10 pt-2.5 text-[11px] font-semibold text-white/45">
                  {on ? "Picked. Click the chip to drop it." : "Click the chip to pick it."}
                </p>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {chosen.length > 0 && (
        <>
          {/* The summary: secondary, so a lighter dark, and small until a line is opened. */}
          <div className="mt-4 rounded-xl bg-[#3a3b3f] p-1.5 text-white">
            <ul className={cn("scrollbar-neo-dark overflow-y-auto overscroll-contain", opened ? "max-h-[360px]" : "max-h-[88px]")}>
              {chosen.map((gap) => {
                const help = helpFor(gap);
                const open = opened === gap.id;
                return (
                  <li
                    key={gap.id}
                    ref={(row) => {
                      if (row) rows.current.set(gap.id, row);
                      else rows.current.delete(gap.id);
                    }}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => openRow(gap.id)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.06]">
                      <ChevronRight className={cn("h-3.5 w-3.5 flex-none text-[#e1f073] transition-transform", open && "rotate-90")} aria-hidden />
                      <span className={cn("min-w-0 flex-1 text-[13px] font-medium text-white/90", open ? "whitespace-normal" : "truncate")}>
                        {open ? <WithQuantities text={help?.requirement ?? gap.label} /> : (help?.requirement ?? gap.label)}
                      </span>
                      <span className="flex-none text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
                        {help ? (help.status === "partial" ? "Partly" : "Missing") : "Gap"}
                      </span>
                    </button>
                    {open && (
                      <div className="pb-3 pl-8 pr-2.5 pt-1.5">
                        {help ? (
                          <GapDetail help={help} interactive />
                        ) : (
                          <p className="text-[13px] leading-relaxed text-white/80">Say it plainly in a bullet or in your skills, in the posting&apos;s words.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StickerButton variant="primary" size="sm" disabled={!onFix || fixing} onClick={fix}>
              {fixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {chosen.length === 1 ? "Fix it with AI" : `Fix all ${chosen.length} with AI`} · {SUGGESTION_CREDITS} credit
            </StickerButton>
            <span className="text-xs text-black/50">One credit for all of them. Nothing changes until you use the new version.</span>
          </div>
          {fixError && !fixing && (
            <p role="alert" className="mt-2 text-sm text-[#b23c26]">
              {fixError}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default GapPicker;
