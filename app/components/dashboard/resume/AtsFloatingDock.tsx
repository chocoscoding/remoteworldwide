"use client";

// The ATS check and the ask box as one toolbar floating at the foot of the preview — the
// default place for them (owner, 2026-10-17), so the left column can take the width the right
// rail used to hold. One button docks it back into the right rail (see `AtsDockedRail`).
//
// The bar shows where the check stands: none yet (a lime "Check ATS score" that opens a small
// "against a job / general score" menu), checking, the score ring with how many fixes wait, out
// of date with a Recheck beside it, or failed. The score opens a panel above the bar holding the
// same score card and fix cards the docked rail shows (`AiAssistRail`, floating variant). Once a
// check is scored and nothing is open, the bar rests as a small pill, and comes back on hover.

import { useEffect, useRef, useState, type FC } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Info,
  Loader2,
  PanelRightOpen,
  RotateCw,
  Sparkle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SCAN_CREDITS } from "@/app/lib/ats/api";
import { scoreColor, scoreTrackColor } from "@/app/lib/apply/score";
import {
  MAX_ASK_INSTRUCTION_CHARS,
  SUGGESTION_CREDITS,
} from "@/app/lib/resume/ai";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import AiAssistRail, { type AiAssistRailProps } from "./AiAssistRail";

/** Quick instructions for the ask box, as the design has them. */
const ASK_CHIPS = [
  "Make it shorter",
  "Lead with the result",
  "Sound more senior",
] as const;

export interface AtsToolsProps extends AiAssistRailProps {
  /** The job a check "against a job" would use now, as "Role at Company"; null opens the picker. */
  jobLabel: string | null;
}

/** The score as a small ring with its number in the hole; faded while it is out of date. */
export const MiniScore: FC<{ score: number; size: number; stale: boolean }> = ({
  score,
  size,
  stale,
}) => (
  <span
    role="img"
    aria-label={`ATS score ${score} out of 100`}
    className={cn("flex-none transition-opacity", stale && "opacity-50")}
  >
    <ScoreRing
      value={score}
      size={size}
      fillColor={scoreColor(score)}
      trackColor={scoreTrackColor(score)}
      label={
        <span
          className={cn(
            "font-extrabold text-primary",
            size >= 36 ? "text-xs" : "text-[10px]",
          )}
        >
          {score}
        </span>
      }
    />
  </span>
);

/** The dashed empty ring that stands for "no check yet". */
export const EmptyRing: FC<{ size: number }> = ({ size }) => (
  <span
    aria-hidden
    style={{ width: size, height: size }}
    className="flex-none rounded-full border-[3px] border-dashed border-[#222325]/35"
  />
);

/** How many fix cards are still waiting on the person. */
export const fixesToReview = (
  props: Pick<AiAssistRailProps, "cards" | "suggestionOutcomes">,
) => props.cards.filter((card) => !props.suggestionOutcomes[card.id]).length;

const AtsFloatingDock: FC<AtsToolsProps & { onDock: () => void }> = (props) => {
  const {
    isBlank,
    check,
    stale,
    checkStatus,
    checkFailure,
    onCheckGeneral,
    onCheckAgainstJob,
    onRecheck,
    aiRunning,
    jobLabel,
    onDock,
  } = props;
  const [panel, setPanel] = useState(false);
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState(false);
  const [hover, setHover] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLInputElement>(null);

  const checking = checkStatus === "preparing" || checkStatus === "scoring";
  const score = check?.report?.score ?? null;
  const toReview = fixesToReview(props);
  const asking = aiRunning === "ask";
  const failed = !!checkFailure && !checking;

  // A check that finishes opens its panel, so the score and its fixes are seen without a click.
  const wasChecking = useRef(checking);
  useEffect(() => {
    if (wasChecking.current && !checking && score !== null) {
      setPanel(true);
      setAsk(false);
    }
    wasChecking.current = checking;
  }, [checking, score]);

  // Escape closes whatever is open; a click outside the dock closes the menu and the panel.
  // "/" anywhere outside a field opens the ask box, as the hint on it says.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        setPanel(false);
        setAsk(false);
        return;
      }
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey)
        return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [role='dialog']"))
      )
        return;
      event.preventDefault();
      setAsk(true);
      setPanel(false);
      setMenu(false);
    };
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenu(false);
        setPanel(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  useEffect(() => {
    if (ask) askRef.current?.focus();
  }, [ask]);

  const submitAsk = () => {
    if (!props.askInput.trim() || aiRunning !== null) return;
    props.onAskSubmit();
  };

  // The full bar whenever something is going on or the pointer is on it; the small pill once a
  // scored check is simply standing.
  const full =
    hover ||
    panel ||
    menu ||
    ask ||
    asking ||
    checking ||
    failed ||
    score === null;

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="pointer-events-none flex flex-col items-center gap-2.5"
    >
      {menu && (
        <div
          role="menu"
          className="pointer-events-auto flex w-[300px] animate-in fade-in slide-in-from-bottom-1 flex-col rounded-xl border-[1.5px] border-[#222325] bg-white p-1.5 br-shadow"
        >
          <span className="px-2.5 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]">
            Check this resume…
          </span>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onCheckAgainstJob();
            }}
            className="flex cursor-pointer flex-col items-start gap-px rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#f6f6f6]"
          >
            <span className="text-sm font-extrabold text-primary">
              Against a job
            </span>
            <span className="text-xs text-[#5f6062]">
              {jobLabel ?? "Pick a saved job or paste a posting"}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onCheckGeneral();
            }}
            className="flex cursor-pointer flex-col items-start gap-px rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#f6f6f6]"
          >
            <span className="text-sm font-extrabold text-primary">
              General score
            </span>
            <span className="text-xs text-[#5f6062]">
              How it reads to applicant tracking systems
            </span>
          </button>
          <span className="px-2.5 pb-1 pt-1.5 text-[11px] text-[#8a8b85]">
            {SCAN_CREDITS} credit per check
          </span>
        </div>
      )}

      {panel && (
        <div
          role="dialog"
          aria-label="ATS score"
          className="pointer-events-auto relative w-[420px] max-w-[calc(100vw-48px)] animate-in fade-in slide-in-from-bottom-1 rounded-2xl border-[1.5px] border-[#222325] bg-[#f6f6f6] p-2 br-shadow"
        >
          <button
            type="button"
            aria-label="Minimise"
            onClick={() => setPanel(false)}
            className="absolute right-4 top-4 z-10 grid h-7 w-7 cursor-pointer place-content-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <AiAssistRail {...props} variant="float" />
        </div>
      )}

      {ask && (
        <div className="pointer-events-auto flex w-[560px] max-w-[calc(100vw-48px)] animate-in fade-in slide-in-from-bottom-1 flex-col gap-2 rounded-2xl border-[1.5px] border-[#222325] bg-white p-2.5 br-shadow">
          <span className="flex items-center gap-1.5 text-xs text-[#5f6062]">
            {/* The AI mark leads the box (owner, 2026-10-18), the same one the dock's Ask AI wears. */}
            <span className="flex items-center gap-1.5 rounded-full bg-[#eef6ad] py-px pl-1.5 pr-2 font-bold text-primary">
              <Sparkle className="h-3.5 w-3.5" strokeWidth={2} />
              Ask AI
            </span>
            <span className="flex-1" />
            {/* An icon with its label on hover (owner, 2026-10-18), not a line of text on the box. */}
            <span
              tabIndex={0}
              aria-label="Uses what's on your resume. Numbers it adds for you are marked on the page to check."
              title="Uses what's on your resume. Numbers it adds for you are marked on the page to check."
              className="grid h-6 w-6 cursor-help place-content-center text-[#8a8b85] hover:text-primary"
            >
              <Info className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setAsk(false)}
              className="grid h-6 w-6 cursor-pointer place-content-center text-[#5f6062] hover:text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
          {props.askError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#b23c26]/30 bg-[#fdf4f2] px-3 py-2">
              <p className="flex-1 text-xs font-semibold leading-relaxed text-[#b23c26]">{props.askError}</p>
              {props.onDismissAskError && (
                <button
                  type="button"
                  onClick={props.onDismissAskError}
                  aria-label="Dismiss"
                  className="flex-none cursor-pointer text-[#b23c26]/60 hover:text-[#b23c26]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {props.askStatus && (
            <div className="flex items-start gap-2 rounded-lg bg-[#f6f6f6] px-3 py-2">
              <p className="flex-1 text-xs leading-relaxed text-black/65">
                {props.askStatus}
              </p>
              <button
                type="button"
                onClick={props.onDismissAskStatus}
                aria-label="Dismiss"
                className="flex-none cursor-pointer text-black/35 hover:text-black/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <input
            ref={askRef}
            type="text"
            value={props.askInput}
            onChange={(e) => props.onAskInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAsk();
            }}
            maxLength={MAX_ASK_INSTRUCTION_CHARS}
            disabled={asking}
            aria-label="Ask for a rewrite"
            placeholder={
              asking ? "Rewriting your resume…" : "What should change?"
            }
            className="h-10 bg-transparent px-0.5 text-sm text-primary outline-none placeholder:text-black/45"
          />
          <span className="flex flex-wrap items-center gap-1.5">
            {ASK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => props.onAskInputChange(chip)}
                className="h-[26px] cursor-pointer rounded-full border border-transparent bg-[#f0f0ea] px-2.5 text-xs font-semibold text-primary transition-colors hover:border-[#222325]"
              >
                {chip}
              </button>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={submitAsk}
              disabled={!props.askInput.trim() || aiRunning !== null}
              aria-label={`Send · ${SUGGESTION_CREDITS} credit`}
              title={`Send · ${SUGGESTION_CREDITS} credit`}
              className="grid h-8 w-8 flex-none cursor-pointer place-content-center rounded-lg bg-[#222325] transition-opacity disabled:cursor-default disabled:opacity-30"
            >
              {asking ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#e1f073]" />
              ) : (
                <ArrowUp className="h-4 w-4 text-[#e1f073]" strokeWidth={2.4} />
              )}
            </button>
          </span>
        </div>
      )}

      {full ? (
        <div
          role="toolbar"
          aria-label="Resume tools"
          className="pointer-events-auto flex items-center gap-1 whitespace-nowrap rounded-[14px] border-[1.5px] border-[#222325] bg-white p-[5px] br-shadow"
        >
          {checking ? (
            <span className="flex h-9 items-center gap-2 rounded-[9px] bg-[#f0f0ea] pl-1.5 pr-3 text-[13px] font-bold text-[#55564f]">
              <Loader2
                className="h-6 w-6 animate-spin text-primary"
                strokeWidth={2.4}
              />
              {checkStatus === "scoring" ? "Scoring…" : "Reading your resume…"}
            </span>
          ) : score !== null && check ? (
            <>
              <button
                type="button"
                aria-label="ATS score"
                aria-expanded={panel}
                onClick={() => {
                  setPanel((open) => !open);
                  setMenu(false);
                  setAsk(false);
                }}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2 rounded-[9px] pl-1.5 pr-2.5 text-[13px] font-bold text-primary transition-colors hover:bg-[#f6f6f6]",
                  panel && "bg-[#f0f0ea] hover:bg-[#f0f0ea]",
                )}
              >
                <MiniScore score={score} size={28} stale={stale} />
                {stale ? (
                  <span className="font-semibold text-[#5f6062]">
                    Out of date
                  </span>
                ) : (
                  "ATS"
                )}
                {toReview > 0 ? (
                  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#b23c26] px-[5px] text-[11px] font-extrabold text-white">
                    {toReview}
                  </span>
                ) : (
                  <span className="grid h-[18px] w-[18px] place-content-center rounded-full border-[1.5px] border-[#222325] bg-[#e1f073]">
                    <Check className="h-2.5 w-2.5" strokeWidth={4} />
                  </span>
                )}
              </button>
              {stale && (
                <button
                  type="button"
                  onClick={onRecheck}
                  title={`Check again · ${SCAN_CREDITS} credit`}
                  className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[7px] border-[1.5px] border-[#222325] bg-[#e1f073] px-2.5 text-xs font-extrabold text-primary"
                >
                  <RotateCw className="h-3 w-3" strokeWidth={2.6} />
                  Recheck
                </button>
              )}
            </>
          ) : failed ? (
            <button
              type="button"
              onClick={() => setPanel(true)}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-[#b23c26] px-2.5 text-[13px] font-bold text-[#b23c26]"
            >
              Couldn&apos;t check · see why
            </button>
          ) : (
            <button
              type="button"
              disabled={isBlank}
              title={
                isBlank
                  ? "Add a summary, experience, or skills first"
                  : undefined
              }
              onClick={() => {
                setMenu((open) => !open);
                setAsk(false);
                setPanel(false);
              }}
              className={cn(
                "flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border-[1.5px] border-[#222325] pl-1.5 pr-3 text-[13px] font-extrabold text-primary disabled:cursor-default disabled:opacity-50",
                menu ? "bg-[#f0f0ea]" : "bg-[#e1f073]",
              )}
            >
              <EmptyRing size={24} />
              Check ATS score
              {menu && <ChevronDown className="h-3 w-3" strokeWidth={2.4} />}
            </button>
          )}

          <span aria-hidden className="mx-1 h-[22px] w-px bg-[#222325]/15" />

          {asking ? (
            <span className="flex h-9 w-[250px] items-center gap-2 rounded-[9px] bg-[#f6f6f6] px-2.5 text-[13px] font-semibold text-[#55564f]">
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-[#6c7a1e]"
                strokeWidth={2.4}
              />
              Rewriting your resume…
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAsk((open) => !open);
                setPanel(false);
                setMenu(false);
              }}
              className={cn(
                "flex h-9 w-[250px] cursor-pointer items-center gap-2 rounded-[9px] pl-2.5 pr-1 text-left text-[13px] text-[#8a8b85]",
                ask ? "bg-[#eef6ad]" : "bg-[#f6f6f6] hover:bg-[#f0f0ea]",
              )}
            >
              <Sparkle
                className="h-3.5 w-3.5 flex-none text-primary"
                strokeWidth={2}
              />
              <span className="flex-1 font-semibold text-primary">Ask AI</span>
              <span className="rounded-[5px] border border-[#222325]/20 px-1.5 py-px text-[11px] font-bold">
                /
              </span>
            </button>
          )}

          <span aria-hidden className="mx-0.5 h-[22px] w-px bg-[#222325]/15" />

          <button
            type="button"
            onClick={onDock}
            aria-label="Dock to sidebar"
            title="Dock to sidebar"
            className="grid h-[34px] w-[34px] cursor-pointer place-content-center rounded-[9px] text-primary transition-colors hover:bg-[#f6f6f6]"
          >
            <PanelRightOpen className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div
          role="toolbar"
          aria-label="Resume tools, collapsed"
          className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[#222325]/20 bg-white p-1"
        >
          {score !== null && (
            <span className="flex h-8 items-center gap-1.5 pl-1 pr-2">
              <MiniScore score={score} size={26} stale={stale} />
              {toReview > 0 && (
                <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#b23c26] px-[5px] text-[10.5px] font-extrabold text-white">
                  {toReview}
                </span>
              )}
            </span>
          )}
          <span aria-hidden className="h-5 w-px bg-[#222325]/15" />
          <span className="grid h-8 w-8 place-content-center">
            <Sparkle
              className="h-[15px] w-[15px] text-primary"
              strokeWidth={2}
            />
          </span>
        </div>
      )}
    </div>
  );
};

export default AtsFloatingDock;
