"use client";

// Step 3 — the cover letter.
//
// Written by the cover letter service (`generateCoverLetter`, COVER_CREDITS a
// letter) from the resume picked in step 2 and this job's posting, then the
// user's to edit: the text in the box is what gets recorded with the
// application, edits included. Writing your own costs nothing, and so does
// sending none.
//
// Tone is a choice for the NEXT letter, never a trigger: each tone is a
// separate letter at a different length, so switching tone to an unwritten one
// only changes what the button will write. A tone already written comes back
// for free, with any edits made to it.

import { useState, type FC } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, PenLine, RotateCw, Sparkles, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { APPLICATION_LIMITS } from "@/app/lib/applications/types";
import { COVER_BILLING_HREF, COVER_CREDITS, COVER_TONES, TONE_PARAGRAPHS, type CoverLetterContent, type CoverTone } from "@/app/lib/cover/api";
import { useCoverLetter } from "@/hooks/mutations/useCoverLetter";
import type { StartedJob } from "../job";

export interface CoverStepProps {
  job: StartedJob;
  resumeId: string | null;
  resumeName: string | null;
  /** The letter as it will be sent. Empty until one is written or typed. */
  letter: string;
  onLetterChange: (text: string) => void;
  skipped: boolean;
  onSkippedChange: (skipped: boolean) => void;
  onPickResume: () => void;
}

const TONE_LABELS: Record<CoverTone, string> = {
  warm: "Warm & direct",
  formal: "Formal",
  story: "Story-led",
  short: "Short",
};

/** A written letter as the plain text the box holds and the application records. */
const textOf = (letter: CoverLetterContent): string =>
  [letter.greeting, "", ...letter.paragraphs.flatMap((paragraph) => [paragraph, ""]), letter.signOff].join("\n").trim();

const wordsIn = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** Which draft is on screen: a tone the service wrote, or the user's own. */
type Shown = CoverTone | "own";

const CoverStep: FC<CoverStepProps> = ({ job, resumeId, resumeName, letter, onLetterChange, skipped, onSkippedChange, onPickResume }) => {
  const cover = useCoverLetter();
  const [tone, setTone] = useState<CoverTone>("warm");
  const [shown, setShown] = useState<Shown | null>(null);
  // Each tone's latest text, edits included, so going back to one is free.
  const [drafts, setDrafts] = useState<Partial<Record<Shown, string>>>({});
  const [writtenFrom, setWrittenFrom] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** The drafts with what is on screen kept under the draft it came from. */
  const keepShown = () => (shown ? { ...drafts, [shown]: letter } : drafts);

  async function write(nextTone: CoverTone) {
    if (!resumeId) return;
    const written = await cover.run({
      resumeId,
      company: job.company,
      role: job.role,
      jdText: job.description,
      jobId: job.savedJobId,
      tone: nextTone,
    });
    if (!written) return;
    const text = textOf(written);
    setDrafts({ ...keepShown(), [nextTone]: text });
    setShown(nextTone);
    setWrittenFrom(resumeId);
    onLetterChange(text);
    onSkippedChange(false);
  }

  function chooseTone(next: CoverTone) {
    if (cover.writing) return;
    setTone(next);
    const kept = keepShown();
    setDrafts(kept);
    const existing = kept[next];
    if (existing !== undefined) {
      setShown(next);
      onLetterChange(existing);
    }
  }

  function writeOwn() {
    const kept = keepShown();
    setDrafts(kept);
    setShown("own");
    onLetterChange(kept.own ?? `Hi ${job.company} team,\n\n\n\nBest,\n`);
    onSkippedChange(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the text is still in the box to select.
    }
  }

  if (!resumeId) {
    return (
      <DashEmptyState
        icon={PenLine}
        title="Pick the resume you're sending first"
        body="The letter is written from the resume that goes with it, so it can only quote what that resume actually says."
        ctaLabel="Choose a resume"
        onCta={onPickResume}
      />
    );
  }

  if (skipped) {
    return (
      <DashCard className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-bold text-primary">No cover letter with this one</p>
          <p className="text-xs text-black/45">Plenty of forms don&apos;t ask for one. You can add it back any time before you track it.</p>
        </div>
        <StickerButton variant="outline" size="md" onClick={() => onSkippedChange(false)}>
          Add a letter after all
        </StickerButton>
      </DashCard>
    );
  }

  const nextIsRewrite = shown === tone;
  const hasLetter = shown !== null;

  return (
    <div className="flex flex-col gap-5">
      <DashCard className="p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-primary">Cover letter</p>
            <p className="text-xs text-black/45">
              Written from {resumeName ?? "your resume"} and this posting. Edit it freely — what&apos;s in the box is what gets recorded.
            </p>
          </div>
          <StickerButton variant="outline" size="sm" onClick={() => onSkippedChange(true)}>
            <SkipForward className="h-3.5 w-3.5" />
            Send without one
          </StickerButton>
        </div>

        {/* Tone, for the next letter */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Tone">
          {COVER_TONES.map((id) => {
            const active = tone === id;
            const written = drafts[id] !== undefined || shown === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                disabled={cover.writing}
                onClick={() => chooseTone(id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed",
                  active ? "bg-[#e1f073] text-primary" : "text-black/55 hover:bg-[#f0f0ea] hover:text-primary",
                )}>
                {TONE_LABELS[id]}
                <span className="font-normal text-black/45">{TONE_PARAGRAPHS[id]} ¶</span>
                {written && <Check className="h-3 w-3 text-[#6c7a1e]" aria-label="written" />}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StickerButton variant="primary" size="md" disabled={cover.writing} onClick={() => void write(tone)}>
            {cover.writing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : nextIsRewrite ? (
              <RotateCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {cover.writing ? "Writing…" : nextIsRewrite ? `Rewrite · ${COVER_CREDITS} credits` : `Write a ${TONE_LABELS[tone].toLowerCase()} letter · ${COVER_CREDITS} credits`}
          </StickerButton>
          {shown !== "own" && (
            <StickerButton variant="outline" size="md" disabled={cover.writing} onClick={writeOwn}>
              <PenLine className="h-4 w-4" />
              Write my own
            </StickerButton>
          )}
        </div>

        {cover.failure && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#b23c26]/20 bg-[#fdf4f2] px-4 py-3" role="alert">
            <p className="min-w-0 flex-1 text-sm text-[#b23c26]">{cover.failure.message}</p>
            {cover.failure.kind === "credits" && (
              <Link href={COVER_BILLING_HREF} target="_blank" rel="noopener noreferrer">
                <StickerButton variant="primary" size="sm">
                  Top up credits
                </StickerButton>
              </Link>
            )}
            {cover.failure.kind === "resume" && (
              <StickerButton variant="outline" size="sm" onClick={onPickResume}>
                Pick another resume
              </StickerButton>
            )}
          </div>
        )}
      </DashCard>

      {hasLetter && (
        <DashCard className="p-6">
          {writtenFrom && writtenFrom !== resumeId && shown !== "own" && (
            <p className="mb-3 rounded-lg bg-[#fbfbf7] px-3 py-2 text-xs text-black/55">
              This letter was written from a different resume than the one you&apos;re sending now. Rewrite it so the two agree.
            </p>
          )}
          <label className="sr-only" htmlFor="apply-letter">
            Cover letter
          </label>
          <AutoGrowTextarea
            id="apply-letter"
            minRows={10}
            value={letter}
            maxLength={APPLICATION_LIMITS.coverLetterMax}
            // A letter on its way replaces this one; typing into it meanwhile would be lost.
            readOnly={cover.writing}
            onChange={(e) => onLetterChange(e.target.value)}
            className="w-full rounded-xl border border-black/15 p-4 text-sm leading-relaxed text-black/75 outline-none focus:border-[#222325]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-black/45">
              {wordsIn(letter)} words · {shown === "own" ? "your own" : TONE_LABELS[shown as CoverTone].toLowerCase()}
            </span>
            <StickerButton variant="outline" size="sm" disabled={!letter.trim()} onClick={() => void copy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </StickerButton>
          </div>
        </DashCard>
      )}
    </div>
  );
};

export default CoverStep;
