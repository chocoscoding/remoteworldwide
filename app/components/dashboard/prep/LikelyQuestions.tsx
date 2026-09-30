"use client";

import type { FC } from "react";
import Link from "next/link";
import { format as formatDate } from "date-fns";
import { FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORMAT_META, type PrepTrack, type SessionFormat } from "@/app/lib/dashboard/prep-data";
import { apiMessage } from "@/app/lib/api/core";
import { describeLikelyQuestionsFailure } from "@/app/lib/prep/api";
import { PREP_BILLING_HREF } from "@/app/lib/voice/api";
import { useGenerateLikelyQuestions } from "@/hooks/mutations/usePrepTrackMutations";
import { useLikelyQuestions } from "@/hooks/queries/usePrepTrackQueries";
import Chip from "./Chip";
import PrepEmptyState from "./PrepEmptyState";
import { useTrackResume } from "./useTrackResume";
import { BUTTON_OUTLINE, BUTTON_SOLID } from "./prep-styles";

export interface LikelyQuestionsProps {
  track: PrepTrack;
  /** The overview shows the first three; the tab shows them all, each with Practise. */
  variant: "preview" | "full";
  onPractise: (format: SessionFormat) => void;
  /** Opens the track's details, where a posting is added. */
  onAddPosting: () => void;
  onSeeAll?: () => void;
}

const PREVIEW_COUNT = 3;

const credits = (n: number) => `${n} ${n === 1 ? "credit" : "credits"}`;

/**
 * The questions this track's interviewers are most likely to ask, written by
 * the AI service from the posting's requirements and the user's resume. Never
 * written on its own: a set costs a credit, so it is only ever written from a
 * click, and reopening one is free. Nothing here claims to know who is in the
 * room — there is no source for that.
 */
const LikelyQuestions: FC<LikelyQuestionsProps> = ({ track, variant, onPractise, onAddPosting, onSeeAll }) => {
  const saved = track.saved;
  const trackId = saved ? track.id : null;
  const hasPosting = Boolean(saved && (saved.savedJobId || saved.hasJobDescription));
  const query = useLikelyQuestions(trackId);
  const generate = useGenerateLikelyQuestions();
  const resume = useTrackResume(saved);
  const failure = generate.error ? describeLikelyQuestionsFailure(generate.error) : null;

  const state = query.data;
  const set = state?.set ?? null;
  const cost = state?.cost ?? 1;
  const busy = generate.isPending || resume.busy !== null;

  async function write(refresh: boolean) {
    if (!trackId || busy) return;
    // A set is written from the track's resume. While that is the master
    // document — a file the AI service cannot read — it is parsed onto the
    // track first, once: otherwise the set would be written without a resume
    // and go stale, a credit wasted, the moment the first session stored it.
    if (resume.source.kind === "master") {
      generate.reset();
      if (!(await resume.storeDefault())) return;
    }
    generate.mutate({ trackId, refresh });
  }

  const failureNote = (failure || resume.error) && (
    <p role="alert" className="text-xs leading-relaxed text-red-700">
      {failure?.message ?? resume.error}
      {failure?.kind === "credits" && (
        <>
          {" "}
          <Link href={PREP_BILLING_HREF} className="font-bold underline underline-offset-2">
            Top up
          </Link>
        </>
      )}
    </p>
  );

  if (!saved) {
    return <PrepEmptyState bare icon={Sparkles} title="No questions for this session" body="Its track is gone, so there is no posting to write questions from." />;
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2 px-5 py-4" aria-busy="true">
        <p className="sr-only" role="status">
          Loading likely questions
        </p>
        {Array.from({ length: variant === "preview" ? 3 : 5 }, (_, i) => (
          <div key={i} className="h-10 rounded-lg bg-[#f0f0ea] animate-pulse" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <PrepEmptyState
        bare
        icon={Sparkles}
        title="Likely questions couldn't load"
        body={apiMessage(query.error)}
        ctaLabel="Try again"
        onCta={() => void query.refetch()}
        ctaBusy={query.isRefetching}
      />
    );
  }

  if (!set) {
    if (!hasPosting || failure?.kind === "no-posting") {
      return (
        <PrepEmptyState
          bare
          icon={FileText}
          title="Add the job description"
          body="Likely questions are written from what the posting asks for and your resume. Paste the posting into this track, or link one of your saved jobs."
          ctaLabel="Add the posting"
          onCta={onAddPosting}
        />
      );
    }
    return (
      <div className="px-6 py-8 flex flex-col items-center text-center gap-3">
        <span className="h-12 w-12 rounded-full bg-[#f0f0ea] flex items-center justify-center">
          <Sparkles className="h-4.5 w-4.5 text-black/40" />
        </span>
        <div>
          <p className="text-sm font-bold text-primary mb-1">No questions yet</p>
          <p className="text-sm text-black/50 max-w-sm mx-auto leading-relaxed">
            Written from the posting&apos;s requirements and your resume: where you&apos;re strong, and where they&apos;ll probe. {credits(cost)}; reopening them is free.
          </p>
        </div>
        <button type="button" onClick={() => void write(false)} disabled={busy} className={cn(BUTTON_SOLID, "disabled:opacity-50 disabled:pointer-events-none")}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {busy ? "Writing questions…" : `Write likely questions · ${credits(cost)}`}
        </button>
        {failureNote}
      </div>
    );
  }

  const questions = variant === "preview" ? set.questions.slice(0, PREVIEW_COUNT) : set.questions;
  const grounding = [
    set.grounding.requirements > 0 ? `${set.grounding.requirements} requirements in the posting` : "the posting",
    set.grounding.resume ? "your resume" : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <div>
      {questions.map((q) => (
        <div key={q.id} className="flex items-start gap-3.5 px-5 py-3.5 border-b border-black/10">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary">{q.text}</p>
            <p className="text-xs text-black/45 mt-0.5">{q.why}</p>
            {variant === "full" && q.requirement && <p className="text-[11px] text-black/35 mt-1">Probes: {q.requirement}</p>}
          </div>
          <Chip tone="white">{FORMAT_META[q.format].label}</Chip>
          {variant === "full" && (
            <button type="button" onClick={() => onPractise(q.format)} className={cn(BUTTON_OUTLINE, "flex-none")}>
              Practise
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3">
        <p className="text-[11px] text-black/40">
          Written {formatDate(new Date(set.generatedAt), "d MMM")} from {grounding}.
          {state?.stale && <span className="text-[#8a6d00] font-semibold"> The posting or this job&apos;s resume has changed since.</span>}
        </p>
        <div className="flex items-center gap-3">
          {variant === "preview" && set.questions.length > PREVIEW_COUNT && onSeeAll && (
            <button type="button" onClick={onSeeAll} className="text-xs font-bold text-black/50 hover:text-primary cursor-pointer whitespace-nowrap">
              See all {set.questions.length} →
            </button>
          )}
          {variant === "full" && (
            <button
              type="button"
              onClick={() => void write(!state?.stale)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer whitespace-nowrap disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {state?.stale ? "Write them again for the changes" : "Write a new set"} · {credits(cost)}
            </button>
          )}
        </div>
      </div>
      {failureNote && <div className="px-5 pb-3">{failureNote}</div>}
    </div>
  );
};

export default LikelyQuestions;
