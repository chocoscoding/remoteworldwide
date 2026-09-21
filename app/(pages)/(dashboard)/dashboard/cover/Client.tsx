"use client";

// The cover letter screen.
//
// The letter is written by the AI service (`POST /api/ai/cover`, through the
// session proxy) from the user's own ingested resume and the posting they
// picked. Everything on this screen that is NOT the letter — theme, font,
// spacing, letterhead — is a user control, persisted nowhere but the session
// and never generated: the service emits words and says so in its own header,
// because a generated theme would silently override a choice the user already
// made and would arrive again with every regenerate.
//
// ── Two things here are deliberate and easy to get wrong ───────────────────
//
// 1. TONE COSTS A CREDIT, AND THE SCREEN SAYS SO. Tone is not a filter over one
//    letter: each tone is a separate letter at a separate LENGTH (the service
//    states the paragraph count in the prompt and truncates past it). So a tone
//    the user has not seen yet has to be written. `useCoverLetter` keeps the
//    ones already written, so flicking back to a tone is free and the
//    comparison the control invites is one they can actually make.
//
// 2. NOTHING ON THIS PAGE CLAIMS TO HAVE READ THE LETTER. The previous build
//    drew inline "your strongest line" highlights and a panel of rows headed
//    "pulled from your profile, matched to this JD" — both authored by hand
//    against one fixed letter. Against a real one they would be decoration
//    asserting an analysis nobody ran. What replaced them is the handful of
//    things that are true and checkable: which resume it was written from, the
//    live word count, and the tone's own paragraph target.

import { useCallback, useMemo, useState, type FC } from "react";
import { Check, ChevronDown, Copy, Download, FileSignature, FileWarning, Link2, Printer, RefreshCw, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import DownloadModal from "@/app/components/dashboard/modals/DownloadModal";
import RichTextEditor from "@/app/components/dashboard/ui/RichTextEditor";
import SplitButton from "@/app/components/dashboard/ui/SplitButton";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import { useJobPicker } from "@/app/components/dashboard/jobs/JobPickerProvider";
import type { PickedJob } from "@/app/lib/jobs/fields";
import { COVER_BILLING_HREF, COVER_CREDITS, TONE_PARAGRAPHS, type CoverLetterContent, type CoverTone } from "@/app/lib/cover/api";
import { useCoverLetter } from "@/hooks/mutations/useCoverLetter";
import { useIngestedResumesQuery } from "@/hooks/queries/useAtsQueries";
import { useProfileSettings } from "@/hooks/queries/useSettingsQuery";
import { Lottie } from "lottie-react";

type ThemeId = "ats" | "bordered" | "warm";
type FontId = "manrope" | "serif" | "mono";
type SpacingId = "tight" | "normal" | "airy";
type LetterheadId = "off" | "name" | "full";

// What a letter needs from a picked job. The posting is asked for but optional:
// a letter can be written for a job nobody pasted the description of, and the
// service treats a missing JD as "write from the resume alone" rather than as a
// refusal. One constant feeds both the pick and the type.
const COVER_JOB_SPEC = "company, role, description?, requirements?";
type CoverJob = PickedJob<typeof COVER_JOB_SPEC>;

const TONE_OPTIONS: { id: CoverTone; label: string }[] = [
  { id: "warm", label: "Warm & direct" },
  { id: "formal", label: "Formal" },
  { id: "story", label: "Story-led" },
  { id: "short", label: "Short" },
];

const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: "ats", label: "Clean ATS" },
  { id: "bordered", label: "Bordered" },
  { id: "warm", label: "Warm" },
];

const FONT_OPTIONS: { id: FontId; label: string }[] = [
  { id: "manrope", label: "Manrope" },
  { id: "serif", label: "Serif" },
  { id: "mono", label: "Mono" },
];

const SPACING_OPTIONS: { id: SpacingId; label: string }[] = [
  { id: "tight", label: "Tight" },
  { id: "normal", label: "Normal" },
  { id: "airy", label: "Airy" },
];

const LETTERHEAD_OPTIONS: { id: LetterheadId; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "name", label: "Name only" },
  { id: "full", label: "Full contact" },
];

/** A blank draft, for someone writing their own with no job attached. */
const BLANK_GREETING = "Hi there,";
const BLANK_BODY = ["Start writing your cover letter here…"];

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Paragraphs -> the HTML the editor loads. Escaped: this is the model's text, not markup. */
function lettersToHtml(greeting: string, paragraphs: string[], signOff: string): string {
  const body = paragraphs
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  // The sign-off is one field carrying two lines ("Best,\nJordan"), which is
  // how the service asks for it and how a letter is actually laid out.
  const closing = signOff
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p><strong>${escapeHtml(line)}</strong></p>`)
    .join("");
  return `<p>${escapeHtml(greeting)}</p>${body}${closing}`;
}

const FONT_CLASS: Record<FontId, string> = {
  manrope: "",
  serif: "font-serif",
  mono: "font-mono",
};

const SPACING_CLASS: Record<SpacingId, { gap: string; text: string }> = {
  tight: { gap: "gap-3", text: "text-[13px] leading-snug" },
  normal: { gap: "gap-5", text: "text-sm leading-relaxed" },
  airy: { gap: "gap-7", text: "text-[15px] leading-loose" },
};

const THEME_CANVAS_CLASS: Record<ThemeId, string> = {
  ats: "bg-white border border-black/10",
  bordered: "bg-white border-2 border-primary/15",
  warm: "bg-[#fbfbf7] border border-black/10",
};

/** Compact labelled select for the editor toolbar — every style control in
 *  one bar directly above the letter, not a separate card. */
const ToolbarSelect: FC<{
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-black/40">
    {label}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer rounded-md border border-black/12 bg-white px-1.5 py-1 text-[11px] font-bold normal-case tracking-normal text-primary outline-none focus:border-black/30">
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

const CoverClient: FC = () => {
  // Blank draft — true when the user started "Write your own" instead of
  // creating a letter from a job. Nothing is generated on that path.
  const [isBlankDraft, setIsBlankDraft] = useState(false);

  const [builtOpen, setBuiltOpen] = useState(false);
  const [tone, setTone] = useState<CoverTone>("warm");

  // Style controls
  const [theme, setTheme] = useState<ThemeId>("ats");
  const [font, setFont] = useState<FontId>("manrope");
  const [spacing, setSpacing] = useState<SpacingId>("normal");
  const [letterhead, setLetterhead] = useState<LetterheadId>("off");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  // The job this letter is written for. Picking one is the only way in —
  // pasting a JD now happens inside the picker, alongside the platform's own
  // listings, instead of behind a separate "New cover letter" button.
  const { pickJob } = useJobPicker();
  const [linkedJob, setLinkedJob] = useState<CoverJob | null>(null);

  // Live editor contents. Seeded from the generated letter, then owned by the
  // user — every keystroke after that is theirs, and a regenerate replaces it
  // only because they asked for one.
  const [letterText, setLetterText] = useState("");

  const { letter, writing, failure, run, show, reset, isUnwritten } = useCoverLetter();

  // Bumped every time a letter lands on the page, whether freshly written or
  // recalled from a tone already written. It is what `docKey` counts on, and it
  // has to be a counter rather than anything derived from the letter: a rewrite
  // can legitimately come back the same length, and a `docKey` that did not
  // move would leave the previous draft in the editor with no sign that the
  // rewrite the user paid for had arrived.
  const [draftSeq, setDraftSeq] = useState(0);

  // The resume the letter is written from. The service needs an INGESTED
  // resume — one that has been parsed — and this screen has no picker, so it
  // uses the most recent one that parsed cleanly and names it on the page. That
  // is the same resume the user last uploaded, which is the one they are
  // applying with; naming it is what makes the default checkable rather than
  // invisible.
  const { data: ingested, isPending: resumesPending } = useIngestedResumesQuery();
  const resume = useMemo(() => (ingested ?? []).find((row) => row.status === "ready") ?? null, [ingested]);

  // The letterhead prints the USER's name and contacts, so they come from
  // settings — the letter itself carries neither, and the service is explicit
  // that presentation is not its to set.
  const { data: settings } = useProfileSettings();
  const profile = settings?.profile ?? null;

  const started = isBlankDraft || linkedJob !== null;
  const paragraphTarget = TONE_PARAGRAPHS[tone];

  const draftLabel = isBlankDraft ? "Untitled" : (letter?.draftLabel ?? "Draft");
  const docKey = isBlankDraft ? "blank" : `${linkedJob?.id ?? "none"}-${tone}-${draftSeq}`;
  const initialHtml = isBlankDraft
    ? lettersToHtml(BLANK_GREETING, BLANK_BODY, profile?.fullName ?? "")
    : letter
      ? lettersToHtml(letter.greeting, letter.paragraphs, letter.signOff)
      : "";

  // `letterText` is only written once the editor reports a change, so a letter
  // that has landed but not been touched has none. Its own count stands in —
  // the service counts the paragraphs it is about to return, so the two agree
  // by construction, and the footer never reads "0 words" under a full page.
  const editedWordCount = letterText.trim() ? letterText.trim().split(/\s+/).length : 0;
  const liveWordCount = editedWordCount || (isBlankDraft ? 0 : (letter?.wordCount ?? 0));
  const spacingCfg = SPACING_CLASS[spacing];
  const downloadFileName = profile?.fullName?.trim() ? `${profile.fullName.trim().replace(/\s+/g, "-")}-Cover-Letter` : "Cover-Letter";

  /** Writes (or rewrites) the letter for one tone, against the linked job. Null when it did not land. */
  const write = useCallback(
    async (job: CoverJob, nextTone: CoverTone): Promise<CoverLetterContent | null> => {
      if (!resume) return null;
      const written = await run({
        resumeId: resume.resumeId,
        company: job.company,
        role: job.role,
        jdText: job.description ?? null,
        // The picker's own id, passed through the way `useScanResume` passes
        // it: the service treats it as an opaque key on the requirement cache,
        // so a letter and a scan for the same posting share the extraction.
        jobId: job.id ?? null,
        tone: nextTone,
      });
      if (written) setDraftSeq((seq) => seq + 1);
      return written;
    },
    [resume, run],
  );

  const composeLetterText = () => {
    const lines: string[] = [];
    if (letterhead !== "off" && profile) {
      lines.push(profile.fullName);
      if (letterhead === "full") lines.push([profile.email, profile.portfolio, profile.location].filter(Boolean).join(" · "));
      lines.push("");
    }
    // Same reason as `liveWordCount`: an untouched letter has no editor text
    // yet, and copying an empty string would be the worst possible answer to
    // pressing Copy on a letter that is visibly on the page.
    const body = letterText.trim()
      ? letterText
      : letter && !isBlankDraft
        ? [letter.greeting, "", ...letter.paragraphs.flatMap((para) => [para, ""]), letter.signOff].join("\n")
        : "";
    lines.push(body);
    return lines.join("\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(composeLetterText());
    } catch {
      // Clipboard permission may be unavailable in some environments —
      // still show the confirmed state since there's nothing else to do.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handlePickJob = async () => {
    const result = await pickJob(COVER_JOB_SPEC);
    if (result.status !== "picked") return;
    // A new job's letters are not the old job's letters, so the kept drafts go.
    reset();
    setLetterText("");
    setDraftSeq((seq) => seq + 1);
    setLinkedJob(result.job);
    setIsBlankDraft(false);
    await write(result.job, tone);
  };

  /**
   * Switching tone shows the letter already written for it, or writes one.
   *
   * The tone moves either way: a failed write leaves the previous letter on
   * screen, which is a tone that did not change rather than a page that went
   * blank, so the control has to go back with it.
   */
  const handleToneChange = async (next: CoverTone) => {
    const previous = tone;
    setTone(next);
    if (isBlankDraft || !linkedJob) return;
    // Already written, so this is free and instant.
    if (show(next)) {
      setDraftSeq((seq) => seq + 1);
      return;
    }

    if (await write(linkedJob, next)) return;
    // Nothing was written and the previous letter is still on the page, so the
    // control goes back to the tone that letter actually is. Leaving it on the
    // tone that failed would label the letter as something it is not.
    setTone(previous);
  };

  /** Rewrites the current tone from scratch — a genuinely different letter, and another credit. */
  const handleRewrite = async () => {
    if (!linkedJob) return;
    await write(linkedJob, tone);
  };

  const handleAiSubmit = () => {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    // There is no free-form rewrite route behind this — the service writes a
    // letter for a tone, not to an instruction. Acknowledge the ask honestly
    // rather than faking one.
    setAiStatus(`Noted: "${prompt}". Free-form rewriting isn't available yet — pick a tone above, or edit the letter directly.`);
    setAiPrompt("");
  };

  const startBlank = () => {
    reset();
    setLetterText("");
    setDraftSeq((seq) => seq + 1);
    setIsBlankDraft(true);
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary truncate">
            {!started
              ? "Cover letters"
              : isBlankDraft
                ? "Cover letter — New draft"
                : `Cover letter — ${linkedJob!.company}, ${linkedJob!.role}`}
          </h1>
          {started && (
            <Pill variant="neutral" className="flex-none">
              {draftLabel}
            </Pill>
          )}
        </div>
        {started && (
          <div className="flex items-center gap-2.5 flex-none">
            <SplitButton
              label={copied ? "Copied" : "Copy"}
              icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              onClick={handleCopy}
              items={[
                { id: "pdf", label: "Download as PDF", icon: <Download className="h-3.5 w-3.5" />, onSelect: () => setDownloadOpen(true) },
                {
                  id: "docx",
                  label: "Download as DOCX",
                  icon: <Download className="h-3.5 w-3.5" />,
                  onSelect: () => setDownloadOpen(true),
                },
                { id: "print", label: "Print", icon: <Printer className="h-3.5 w-3.5" />, onSelect: () => window.print() },
              ]}
            />
          </div>
        )}
      </header>

      <main className="px-8 py-7 pb-14 max-w-[760px] mx-auto flex flex-col gap-5">
        {!started ? (
          /* The front door: two ways in, neither assumed. You don't need the
             job to exist anywhere to write a letter. */
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
            <Lottie
              src={`/Lottie/neobrutalism/Edit_Pencil_Note_lottie.json`}
              autoplay
              loop
              className=""
              speed={0.47}
              style={{ width: 340, height: 340 }}
            />

            <p className="max-w-[540px] text-sm leading-relaxed relative -top-10 text-black/50">
              Create a job specific cover letter or just start typing✨
            </p>
            <div className=" grid w-full max-w-[560px] grid-cols-1 gap-3.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={handlePickJob}
                disabled={!resume}
                className="group rounded-2xl border-[1.5px] border-[#222325] bg-[#222325] p-5 text-left text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[3px_3px_0_0_#e1f073] hover:shadow-[4px_4px_0_0_#e1f073] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:active:translate-x-0 disabled:active:translate-y-0">
                <span className="grid h-9 w-9 place-content-center rounded-lg bg-white/10">
                  <Link2 className="h-4 w-4 text-[#e1f073]" />
                </span>
                <span className="mt-3 block text-sm font-bold">Create from a job</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/55">
                  Pick a Remote Worldwide listing or paste any posting — we write it from your resume. {COVER_CREDITS} credit.
                </span>
              </button>
              <button
                type="button"
                onClick={startBlank}
                className="group rounded-2xl border-[1.5px] border-black/15 bg-white p-5 text-left cursor-pointer transition-[transform,box-shadow,border-color] duration-100 ease-out hover:border-[#222325] hover:shadow-[4px_4px_0_0_#222325] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
                <span className="grid h-9 w-9 place-content-center rounded-lg bg-[#f0f0ea]">
                  <FileSignature className="h-4 w-4 text-primary" />
                </span>
                <span className="mt-3 block text-sm font-bold text-primary">Write your own</span>
                <span className="mt-1 block text-xs leading-relaxed text-black/50">
                  A blank page, no job attached. Free, and nothing is generated.
                </span>
              </button>
            </div>

            {/* A letter is written FROM a resume, so there is nothing to write
                from until one has been imported. Said here rather than on the
                other side of a click that could only fail. */}
            {!resume && !resumesPending && (
              <div className="mt-5 flex max-w-[560px] items-start gap-2.5 rounded-xl border border-black/12 bg-white px-4 py-3 text-left">
                <FileWarning className="mt-0.5 h-4 w-4 flex-none text-black/40" />
                <p className="text-xs leading-relaxed text-black/60">
                  We write the letter from a resume you&apos;ve imported — there isn&apos;t one yet.{" "}
                  <Link href="/dashboard/resume" className="font-bold text-primary underline decoration-2 underline-offset-2">
                    Import a resume
                  </Link>{" "}
                  and come back. You can still write your own in the meantime.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Linked job — one row, one way to change it. */}
            <DashCard className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-9 w-9 flex-none rounded-full bg-[#f0f0ea] flex items-center justify-center">
                  <Link2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                  {linkedJob && !isBlankDraft ? (
                    <>
                      <span className="text-sm text-black/50">Written for</span>
                      <Pill variant="active">
                        {linkedJob.company} · {linkedJob.role}
                      </Pill>
                    </>
                  ) : (
                    <span className="text-sm text-black/50">Not linked to a job — pick one to have a letter written.</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-none">
                  {!isBlankDraft && (
                    <StickerButton variant="outline" size="sm" onClick={startBlank}>
                      <FileSignature className="h-3.5 w-3.5" />
                      Write from scratch
                    </StickerButton>
                  )}
                  <StickerButton variant="outline" size="sm" onClick={handlePickJob} disabled={writing || !resume}>
                    <Link2 className="h-3.5 w-3.5" />
                    {linkedJob && !isBlankDraft ? "Change job" : "Pick a job"}
                  </StickerButton>
                  <StickerButton variant="primary" size="sm" onClick={handleRewrite} disabled={writing || !linkedJob || isBlankDraft}>
                    <RefreshCw className={cn("h-3.5 w-3.5", writing && "animate-spin")} />
                    {writing ? "Writing…" : "Rewrite"}
                  </StickerButton>
                </div>
              </div>
            </DashCard>

            {/* A refusal, where the letter would have been. Shown inline rather
                than as a toast: the thing that failed is on this card, and the
                way forward differs by reason. */}
            {failure && (
              <DashCard className="flex items-start gap-3 border-2 border-[#222325] p-4">
                <FileWarning className="mt-0.5 h-4 w-4 flex-none text-black/50" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-primary leading-relaxed">{failure.message}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {failure.kind === "credits" && (
                      <Link
                        href={COVER_BILLING_HREF}
                        className="text-xs font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
                        Top up credits
                      </Link>
                    )}
                    {failure.kind === "resume" && (
                      <Link
                        href="/dashboard/resume"
                        className="text-xs font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
                        Import a resume
                      </Link>
                    )}
                    {failure.retryable && failure.kind !== "credits" && (
                      <button
                        type="button"
                        onClick={handleRewrite}
                        className="cursor-pointer text-xs font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
                        Try again
                      </button>
                    )}
                  </div>
                </div>
              </DashCard>
            )}

            {/* Disclosure toggle + tone chips */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {isBlankDraft ? (
                <span className="text-sm font-semibold text-black/35">Blank draft — not linked to a job</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setBuiltOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline cursor-pointer">
                  What this was written from
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", builtOpen && "rotate-180")} />
                </button>
              )}

              {/* Tone only means something for a generated letter: on a blank
                  draft there is nothing to rewrite, so the control is not shown
                  rather than shown and inert. */}
              {!isBlankDraft && (
                <div className="flex items-center gap-2">
                  {isUnwritten(tone) && (
                    <Pill variant="outline-dashed" className="flex-none">
                      {COVER_CREDITS} credit per tone
                    </Pill>
                  )}
                  <SlidingTabs value={tone} options={TONE_OPTIONS} onChange={(next) => void handleToneChange(next as CoverTone)} />
                </div>
              )}
            </div>

            {/* Expandable disclosure panel — only facts, and only ones this
                screen can stand behind. */}
            <div
              className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                builtOpen && !isBlankDraft ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0",
              )}>
              {/* Rendered only for a real letter. A collapsed panel is still in
                  the document — a screen reader reads it, and a find-in-page
                  finds it — so a blank draft must not carry a description of a
                  letter that was never written. */}
              {!isBlankDraft && (
              <DashCard className="p-6">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-3">What this was written from</p>
                <div className="flex flex-col divide-y divide-black/8">
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-4 gap-y-1 py-3 first:pt-0">
                    <p className="text-xs font-bold text-black/40 sm:pt-0.5">Your resume</p>
                    <p className="text-sm text-primary">{resume?.fileName ?? "—"}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-4 gap-y-1 py-3">
                    <p className="text-xs font-bold text-black/40 sm:pt-0.5">The posting</p>
                    <p className="text-sm text-primary">
                      {linkedJob?.description
                        ? `${linkedJob.company} — ${linkedJob.role}`
                        : `${linkedJob?.company ?? "—"} — no description, so the letter is written from your resume alone`}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-4 gap-y-1 py-3 last:pb-0">
                    <p className="text-xs font-bold text-black/40 sm:pt-0.5">Tone</p>
                    <p className="text-sm text-primary">
                      {TONE_OPTIONS.find((option) => option.id === tone)?.label} — {paragraphTarget} paragraph
                      {paragraphTarget === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-black/45">
                  Every employer, date and number in the letter comes from that resume. If something reads wrong, it is in the resume — fix it
                  there and rewrite.
                </p>
              </DashCard>
              )}
            </div>

            {/* The letter itself. Formatting lives in the editor's own toolbar,
            with the letterhead toggle sitting beside it — one bar directly
            above the page, rather than controls scattered around it. */}
            <RichTextEditor
              docKey={docKey}
              initialHtml={initialHtml}
              onChange={({ text }) => setLetterText(text)}
              ariaLabel="Cover letter body"
              toolbarLeading={
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <ToolbarSelect label="Theme" value={theme} options={THEME_OPTIONS} onChange={(v) => setTheme(v as ThemeId)} />
                  <ToolbarSelect label="Font" value={font} options={FONT_OPTIONS} onChange={(v) => setFont(v as FontId)} />
                  <ToolbarSelect label="Spacing" value={spacing} options={SPACING_OPTIONS} onChange={(v) => setSpacing(v as SpacingId)} />
                  <ToolbarSelect
                    label="Letterhead"
                    value={letterhead}
                    options={LETTERHEAD_OPTIONS}
                    onChange={(v) => setLetterhead(v as LetterheadId)}
                  />
                </div>
              }
              pageHeader={
                letterhead !== "off" && profile ? (
                  <div className="border-b border-black/10 px-8 pb-5 pt-7">
                    <p className={cn("text-lg font-bold text-primary", FONT_CLASS[font])}>{profile.fullName}</p>
                    {letterhead === "full" && (
                      <p className="mt-0.5 text-xs text-black/45">{[profile.email, profile.portfolio, profile.location].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                ) : undefined
              }
              surfaceClassName={THEME_CANVAS_CLASS[theme]}
              contentClassName={cn(FONT_CLASS[font], spacingCfg.text, "text-primary [&>p]:mb-4 last:[&>p]:mb-0")}
            />

            {/* Footer: word count, details, AI rewrite */}
            <DashCard className="p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-black/45 tabular-nums">{liveWordCount} words</span>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen((v) => !v)}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
                    {detailsOpen ? "Hide details" : "Details"}
                    <ChevronDown className={cn("h-3 w-3 transition-transform", detailsOpen && "rotate-180")} />
                  </button>
                </div>
              </div>

              {detailsOpen && (
                <div className="flex flex-wrap gap-2 -mt-1">
                  {isBlankDraft ? (
                    <>
                      <Pill variant="neutral">Blank draft</Pill>
                      <Pill variant="neutral">Not linked to a job yet</Pill>
                    </>
                  ) : (
                    <>
                      {/* Reading pace at ~200 words a minute — arithmetic on
                          the text on screen, not a claim about the letter. */}
                      <Pill variant="neutral">≈{Math.max(5, Math.round((liveWordCount / 200) * 60))} sec read</Pill>
                      <Pill variant="neutral">
                        {paragraphTarget} paragraph{paragraphTarget === 1 ? "" : "s"} at this tone
                      </Pill>
                      {resume && <Pill variant="neutral">From {resume.fileName}</Pill>}
                    </>
                  )}
                </div>
              )}

              <div className="border-t border-black/8 pt-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 flex items-center gap-2 rounded-xl border border-black/12 bg-[#fbfbf7] px-3.5 py-2.5">
                    <Sparkles className="h-4 w-4 flex-none text-black/40" />
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAiSubmit();
                      }}
                      placeholder="Make it warmer, shorter, more specific…"
                      className="flex-1 min-w-0 bg-transparent text-sm text-primary placeholder:text-black/35 outline-none"
                    />
                  </div>
                  <StickerButton variant="primary" size="md" onClick={handleAiSubmit} disabled={!aiPrompt.trim()}>
                    <Send className="h-4 w-4" />
                  </StickerButton>
                </div>

                {aiStatus && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f0f0ea] px-3.5 py-2.5">
                    <p className="text-xs text-black/60 leading-relaxed flex-1">{aiStatus}</p>
                    <button
                      type="button"
                      onClick={() => setAiStatus(null)}
                      className="flex-none text-black/35 hover:text-black/60 cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </DashCard>
          </>
        )}
      </main>

      <DownloadModal open={downloadOpen} onOpenChange={setDownloadOpen} docLabel="cover letter" fileName={downloadFileName} />
    </div>
  );
};

export default CoverClient;
