"use client";

// The ATS check docked into the right column — the other place for it besides the floating dock
// (see `AtsFloatingDock`). Open, it is the full rail (`AiAssistRail`) under a small header with
// "Undock" and "Collapse"; collapsed, it is a 56px strip: the score with its fix count, Recheck
// when out of date, and the ask button, each opening the rail back up.

import { useState, type FC, type ReactNode } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  PanelBottom,
  RotateCw,
  Sparkle,
} from "lucide-react";
import { SCAN_CREDITS, scanCoverage } from "@/app/lib/ats/api";
import AiAssistRail from "./AiAssistRail";
import {
  EmptyRing,
  MiniScore,
  fixesToReview,
  type AtsToolsProps,
} from "./AtsFloatingDock";

const ROUND_BUTTON =
  "grid h-8 w-8 flex-none cursor-pointer place-content-center rounded-full border border-[#222325]/[0.12] bg-white text-primary transition-colors hover:border-[#222325]";

const AtsDockedRail: FC<
  AtsToolsProps & { open: boolean; onToggle: () => void; onFloat: () => void }
> = (props) => {
  const {
    open,
    onToggle,
    onFloat,
    check,
    stale,
    checkStatus,
    checkFailure,
    onRecheck,
    aiRunning,
  } = props;
  const [tip, setTip] = useState(false);

  if (open) {
    const header = (
      <div className="flex h-9 flex-none items-center justify-between pl-0.5 pr-1">
        <h2 className="text-lg font-extrabold text-primary">ATS check</h2>
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onFloat}
            aria-label="Undock, float over the resume"
            title="Undock, float over the resume"
            className={ROUND_BUTTON}
          >
            <PanelBottom className="h-[15px] w-[15px]" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse ATS panel"
            title="Collapse"
            className={ROUND_BUTTON}
          >
            <ChevronsRight className="h-[15px] w-[15px]" strokeWidth={2.2} />
          </button>
        </span>
      </div>
    );
    return <AiAssistRail {...props} header={header} />;
  }

  const checking = checkStatus === "preparing" || checkStatus === "scoring";
  const score = check?.report?.score ?? null;
  // Partly checked against a job: the ring fades, as in the floating dock.
  const partial = Boolean(check?.report && check.job && scanCoverage(check.report).partial);
  const toReview = fixesToReview(props);
  const title =
    score !== null
      ? `ATS ${score}${toReview ? `, ${toReview} fix${toReview === 1 ? "" : "es"} to review` : ", nothing left to fix"}${stale ? ", edited since the check" : ""}`
      : checking
        ? "Checking…"
        : checkFailure
          ? "Check failed. Open to see why."
          : "No ATS check yet. Open to run one.";

  // The hover card beside the strip, as the design has it: what the check says, and what a click does.
  const company = check?.posting?.company;
  const tipTitle =
    score !== null
      ? company
        ? `${score} against ${company}`
        : `${score} · general score`
      : checking
        ? "Checking…"
        : checkFailure
          ? "Check failed"
          : "No ATS check yet";
  const tipBody: ReactNode =
    score !== null ? (
      toReview ? (
        `${toReview} fix${toReview === 1 ? "" : "es"} to review${stale ? " · edited since the check" : ""}. Click to open.`
      ) : (
        "Nothing left to fix."
      )
    ) : checkFailure ? (
      "Nothing was charged. Click to see why."
    ) : checking ? (
      "Reading your resume."
    ) : props.jobLabel ? (
      <>
        Click to check against{" "}
        <strong className="font-bold text-white">{props.jobLabel}</strong> or
        get a general score.
      </>
    ) : (
      "Click to check against a job or get a general score."
    );

  return (
    // One card (owner, 2026-10-17): expand and undock sit at its top, above the score and the ask.
    <div className="relative flex w-14 flex-col items-center">
      <div
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        className="flex w-14 flex-col items-center gap-2.5 rounded-2xl border border-[#222325]/[0.14] bg-white py-2.5"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label="Open ATS panel"
          title="Open"
          className={ROUND_BUTTON}
        >
          <ChevronsLeft className="h-[15px] w-[15px]" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onFloat}
          aria-label="Undock, float over the resume"
          title="Undock"
          className={ROUND_BUTTON}
        >
          <PanelBottom className="h-[15px] w-[15px]" strokeWidth={2} />
        </button>
        <span aria-hidden className="h-px w-7 bg-[#222325]/[0.12]" />
        {checking ? (
          <Loader2
            aria-label="Checking"
            className="h-9 w-9 animate-spin text-primary"
            strokeWidth={2}
          />
        ) : score !== null ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={title}
            className="relative grid h-11 w-11 cursor-pointer place-content-center rounded-full"
          >
            <MiniScore score={score} size={38} stale={stale} partial={partial} />
            {toReview > 0 && (
              <span className="absolute -right-[3px] -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-white bg-[#b23c26] px-1 text-[10px] font-extrabold text-white">
                {toReview}
              </span>
            )}
          </button>
        ) : checkFailure ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={title}
            className="grid h-10 w-10 cursor-pointer place-content-center rounded-full border-[1.5px] border-[#b23c26] font-extrabold text-[#b23c26]"
          >
            !
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-label={title}
            className="grid h-10 w-10 cursor-pointer place-content-center rounded-full border-[1.5px] border-[#222325] bg-[#e1f073] br-shadow-press"
          >
            <EmptyRing size={26} />
          </button>
        )}
        <span className="text-[10px] font-extrabold tracking-[0.06em] text-[#5f6062]">
          ATS
        </span>
        {stale && !checking && (
          <button
            type="button"
            onClick={onRecheck}
            aria-label={`Check again · ${SCAN_CREDITS} credit`}
            title={`Check again · ${SCAN_CREDITS} credit`}
            className="grid h-9 w-9 cursor-pointer place-content-center rounded-[9px] border-[1.5px] border-[#222325] bg-[#e1f073]"
          >
            <RotateCw className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        )}
        <span aria-hidden className="h-px w-7 bg-[#222325]/[0.12]" />
        {aiRunning === "ask" ? (
          <span className="grid h-9 w-9 place-content-center rounded-[9px] bg-[#f0f0ea]">
            <Loader2
              className="h-[15px] w-[15px] animate-spin text-[#6c7a1e]"
              strokeWidth={2.4}
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Ask for a rewrite"
            title="Ask for a rewrite"
            className="grid h-9 w-9 cursor-pointer place-content-center rounded-[9px] bg-[#222325]"
          >
            <Sparkle
              className="h-[15px] w-[15px] text-[#e1f073]"
              strokeWidth={2}
            />
          </button>
        )}
      </div>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute right-[66px] top-[100px] z-30 flex w-60 animate-in fade-in slide-in-from-right-1 flex-col gap-1.5 rounded-xl bg-[#222325] p-3 text-white"
        >
          <span className="text-[13px] font-extrabold">{tipTitle}</span>
          <span className="text-xs leading-relaxed text-white/70">
            {tipBody}
          </span>
          <span
            aria-hidden
            className="absolute -right-[5px] top-[18px] h-2.5 w-2.5 rotate-45 bg-[#222325]"
          />
        </div>
      )}
    </div>
  );
};

export default AtsDockedRail;
