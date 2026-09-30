"use client";

import { useId, useState, type FC, type ReactNode } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportSectionFailure, ReportSectionStatus } from "@/app/lib/voice/types";
import { BUTTON_OUTLINE, PANEL } from "../prep-styles";

/**
 * The states the report's two analysed sections (Positioning, and Diction's
 * grammar and word choice) share. The service writes both after the report is
 * out, so a report can open with either one `pending`, and either can end up
 * `unavailable` while the rest of the report stands. A session analysed before
 * they existed has neither, which is its own state: not analysed, as opposed
 * to analysed with nothing found.
 */

/**
 * The page keeps reading the session while a section is `pending`, up to a
 * ceiling. Past it, `stalled` is true and the section offers `onCheckAgain`
 * rather than promising it will appear on its own.
 */
export interface SectionsPoll {
  stalled: boolean;
  onCheckAgain: () => void;
}

/** Each failure in words, so the reader knows it was not something they did. */
export const SECTION_FAILURE_TEXT: Record<ReportSectionFailure, string> = {
  "model-unavailable": "The model that writes it was unavailable, or didn't give an answer that could be used, when your session was analysed.",
  interrupted: "Its analysis stopped before it finished.",
  "switched-off": "This analysis was switched off when your session was analysed.",
};

const BODY = "mt-1 max-w-[560px] text-sm leading-relaxed text-black/55";

/** A titled card, named by its heading so it reads as a section of its own. */
const StateCard: FC<{ title: string; dashed?: boolean; children: ReactNode }> = ({ title, dashed = false, children }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn(PANEL, "p-6", dashed && "border-dashed")}>
      <h3 id={headingId} className="text-[14.5px] font-bold text-primary">
        {title}
      </h3>
      {children}
    </section>
  );
};

/**
 * A section still being written: one quiet line, since the rest of the report
 * is already there to read. Past the page's polling ceiling it says the wait
 * is unusual and offers to check again.
 */
export const SectionPending: FC<{ title: string; what: string; poll?: SectionsPoll }> = ({ title, what, poll }) => (
  <StateCard title={title}>
    {poll?.stalled ? (
      <>
        <p className={BODY}>Still analysing. This is taking much longer than it should, so the page has stopped checking on its own.</p>
        <button type="button" onClick={poll.onCheckAgain} className={cn(BUTTON_OUTLINE, "mt-4")}>
          <RotateCcw aria-hidden className="h-3.5 w-3.5" />
          Check again
        </button>
      </>
    ) : (
      <p className={cn(BODY, "flex items-start gap-2")}>
        <Loader2 aria-hidden className="mt-[3px] h-3.5 w-3.5 flex-none text-black/40 motion-safe:animate-spin" />
        <span>Analysing… {what} It appears here by itself when it&apos;s done; the rest of your report is ready now.</span>
      </p>
    )}
  </StateCard>
);

/** A section that could not be analysed, and why, in plain words. There is no way to re-run it, so none is offered. */
export const SectionUnavailable: FC<{ title: string; failure: ReportSectionFailure | null }> = ({ title, failure }) => (
  <StateCard title={title}>
    <p className={BODY}>
      Not available for this session. {SECTION_FAILURE_TEXT[failure ?? "model-unavailable"]} The rest of your report is unaffected.
    </p>
  </StateCard>
);

/**
 * A session analysed before this section existed. Said plainly, and with no
 * offer to run it: an old session is not analysed again.
 */
export const SectionNotAnalysed: FC<{ title: string; body: string }> = ({ title, body }) => (
  <StateCard title={title} dashed>
    <p className={BODY}>{body}</p>
  </StateCard>
);

/**
 * Tells a screen reader, once, that a section it was waiting on has arrived.
 * Only a section that was `pending` when this mounted announces anything: one
 * already there when the tab opened is simply read with the rest. Mounted
 * whatever the state, so the region exists before it has something to say.
 */
export const SectionArrival: FC<{ title: string; status: ReportSectionStatus | undefined }> = ({ title, status }) => {
  const [openedPending] = useState(status === "pending");
  const text = !openedPending ? "" : status === "ready" ? `${title} is ready.` : status === "unavailable" ? `${title} couldn't be analysed.` : "";
  return (
    <p role="status" className="sr-only">
      {text}
    </p>
  );
};
