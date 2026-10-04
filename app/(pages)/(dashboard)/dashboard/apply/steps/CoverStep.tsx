"use client";

// Step 3: the cover letter.
//
// Written by the cover letter service (`generateCoverLetter`, COVER_CREDITS a
// letter) from the resume picked in step 2 and this job's posting, then the
// user's to edit in the cover letter creator's own editor (owner, 2026-10-03:
// "the utilities that cover letter creator has, import it into here"): the
// same theme, font, spacing and letterhead controls, bold, italic and lists,
// Copy, download as PDF or Word, Print, and "say how to change it" for
// COVER_REVISE_CREDITS. The letter's text is what gets recorded with the
// application, edits included. Writing your own costs nothing (the editor opens
// on a blank letter to type into, no button needed: owner, 2026-10-03), and so
// does sending none.
//
// Tone is a choice for the NEXT letter, never a trigger: each tone is a
// separate letter at a different length, so switching to an unwritten one only
// changes what the button will write. A tone already written comes back for
// free, with any edits made to it (its words; bold and lists stay with the
// letter on screen).
//
// All of it (the tone, every draft, the letter as edited and its look) lives in
// the application's session (`ApplyCoverState`), so a refresh keeps what was
// paid for.

import { useState, type FC } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, PenLine, Printer, Send, SkipForward, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import RichTextEditor from "@/app/components/dashboard/ui/RichTextEditor";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import SplitButton from "@/app/components/dashboard/ui/SplitButton";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import DownloadModal, { type DownloadFormat } from "@/app/components/dashboard/modals/DownloadModal";
import { LetterSkeleton, ToolbarSelect } from "@/app/components/dashboard/cover/LetterParts";
import { usePlanLock } from "@/app/components/dashboard/billing/PlanLock";
import { APPLICATION_LIMITS } from "@/app/lib/applications/types";
import type { ApplyCoverState, CoverShown } from "@/app/lib/apply/state";
import {
  COVER_BILLING_HREF,
  COVER_CREDITS,
  COVER_REVISE_CREDITS,
  MAX_REVISE_INSTRUCTION_CHARS,
  TONE_PARAGRAPHS,
  describeCoverFailure,
  reviseCoverLetter,
  type CoverLetterContent,
  type CoverTone,
} from "@/app/lib/cover/api";
import {
  FONT_CLASS,
  LETTERHEAD_OPTIONS,
  LETTER_FONT_OPTIONS,
  SPACING_CLASS,
  SPACING_OPTIONS,
  THEME_CANVAS_CLASS,
  THEME_OPTIONS,
  letterheadFor,
  lettersToHtml,
  wordFontFor,
} from "@/app/lib/cover/presentation";
import type { LetterDesign } from "@/app/lib/dashboard/types";
import { coverToDocx, coverToMarkdown, letterheadHtml, sanitizeLetterHtml, textToLetterHtml } from "@/app/lib/export/cover";
import { LETTER_PAGE_MARGIN, LETTER_PAGE_SIZE, LETTER_PRINT_CSS } from "@/app/lib/export/print-css";
import { printDocument, safeFileName, saveBlob, saveText } from "@/app/lib/export/save";
import { qk } from "@/app/lib/query/keys";
import { BASIC_GATES } from "@/app/lib/settings/planGates";
import { useCoverLetter } from "@/hooks/mutations/useCoverLetter";
import { useProfileSettings } from "@/hooks/queries/useSettingsQuery";
import type { StartedJob } from "../job";

export interface CoverStepProps {
  job: StartedJob;
  resumeId: string | null;
  resumeName: string | null;
  /** The letter, its drafts and its tone, as the session keeps them. */
  cover: ApplyCoverState;
  /** Functional, so a letter that lands after a wait is filed against the drafts as they are then. */
  onCoverChange: (recipe: (cover: ApplyCoverState) => ApplyCoverState) => void;
  /** False once the application is tracked. */
  editable: boolean;
  onPickResume: () => void;
}

const TONE_LABELS: Record<CoverTone, string> = {
  warm: "Warm & direct",
  formal: "Formal",
  story: "Story-led",
  short: "Short",
};

const TONE_OPTIONS = (Object.keys(TONE_LABELS) as CoverTone[]).map((id) => ({ id, label: TONE_LABELS[id] }));

/** A written letter as the plain text the application records. */
const textOf = (letter: Pick<CoverLetterContent, "greeting" | "paragraphs" | "signOff">): string =>
  [letter.greeting, "", ...letter.paragraphs.flatMap((paragraph) => [paragraph, ""]), letter.signOff].join("\n").trim();

/** The editor's text as the application records it: no stray non-breaking spaces or runs of blank lines. */
const tidy = (text: string): string =>
  text
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const wordsIn = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** The HTML the editor opens with: the letter as last edited, else its words. Sanitised: it comes back from storage. */
const openingHtml = (cover: Pick<ApplyCoverState, "html" | "letter">): string =>
  cover.html.trim() && typeof DOMParser !== "undefined" ? sanitizeLetterHtml(cover.html) : textToLetterHtml(cover.letter);

const CoverStep: FC<CoverStepProps> = ({ job, resumeId, resumeName, cover: saved, onCoverChange, editable, onPickResume }) => {
  const queryClient = useQueryClient();
  const cover = useCoverLetter();
  const coverLock = usePlanLock(BASIC_GATES.coverLetters);
  const { data: settings } = useProfileSettings();
  const profile = settings?.profile ?? null;
  const [copied, setCopied] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("pdf");
  const [prompt, setPrompt] = useState("");
  const [revising, setRevising] = useState(false);
  const [reviseNote, setReviseNote] = useState<string | null>(null);
  // Nothing written yet: a blank letter to type into, which is how a letter of your own starts.
  const blankLetter = `Hi ${job.company} team,\n\n\n\nBest,`;
  // What the editor loads: bumped whenever a different letter lands, never while it is typed in.
  const [seed, setSeed] = useState(() => ({
    key: 0,
    html: saved.shown === null && !saved.letter.trim() ? textToLetterHtml(blankLetter) : openingHtml(saved),
  }));
  const { tone, shown, writtenFrom, letter, skipped, design } = saved;

  const load = (html: string) => setSeed((prev) => ({ key: prev.key + 1, html }));

  /** The drafts with what is on screen kept under the draft it came from. */
  const keepShown = (state: ApplyCoverState): Partial<Record<CoverShown, string>> =>
    state.shown ? { ...state.drafts, [state.shown]: state.letter } : state.drafts;

  async function write(nextTone: CoverTone) {
    if (!resumeId) return;
    const from = resumeId;
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
    const html = lettersToHtml(written.greeting, written.paragraphs, written.signOff);
    onCoverChange((state) => ({ ...state, drafts: { ...keepShown(state), [nextTone]: text }, shown: nextTone, writtenFrom: from, letter: text, html, skipped: false }));
    load(html);
  }

  function chooseTone(next: CoverTone) {
    if (!editable || cover.writing || revising) return;
    const existing = keepShown(saved)[next];
    onCoverChange((state) => {
      const kept = keepShown(state);
      const text = kept[next];
      return text !== undefined ? { ...state, tone: next, drafts: kept, shown: next, letter: text, html: "" } : { ...state, tone: next, drafts: kept };
    });
    if (existing !== undefined) load(textToLetterHtml(existing));
  }

  const setSkipped = (next: boolean) => onCoverChange((state) => ({ ...state, skipped: next }));
  const setDesign = (patch: Partial<LetterDesign>) => onCoverChange((state) => ({ ...state, design: { ...state.design, ...patch } }));

  /** "Say how to change it": the letter on screen, edits included, rewritten to the instruction. Not saved to the library. */
  async function revise() {
    const instruction = prompt.trim();
    if (!instruction || revising || !letter.trim()) return;
    setRevising(true);
    setReviseNote(null);
    try {
      const revised = await reviseCoverLetter({ letter, instruction, company: job.company, role: job.role, documentId: null });
      const text = textOf(revised);
      const html = lettersToHtml(revised.greeting, revised.paragraphs, revised.signOff);
      onCoverChange((state) => ({ ...state, letter: text, html, drafts: state.shown ? { ...state.drafts, [state.shown]: text } : state.drafts }));
      load(html);
      setPrompt("");
      setReviseNote(`Changed to “${instruction}”. Not quite right? Say what to change next, or edit it directly.`);
    } catch (error) {
      setReviseNote(describeCoverFailure(error).message);
    } finally {
      setRevising(false);
      // Charged or refused, the balance shown elsewhere may be behind now.
      void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
    }
  }

  // ---- Copy, download, print: as the cover letter creator does them ------------------------------
  const letterhead = letterheadFor(design.letterhead, profile);
  const fileBase = safeFileName([profile?.fullName?.trim(), "Cover Letter", job.company].filter(Boolean).join(" ").replace(/\s+/g, "-"));
  const pageHtml = () => (saved.html.trim() ? sanitizeLetterHtml(saved.html) : textToLetterHtml(letter));

  async function copy() {
    const lines = letterhead ? [letterhead.name, ...(letterhead.contact.length > 0 ? [letterhead.contact.join(" · ")] : []), "", letter] : [letter];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the letter is still on the page to select.
    }
  }

  const printLetter = (title = fileBase) =>
    printDocument({
      title,
      html: `<main class="${cn(FONT_CLASS[design.font], SPACING_CLASS[design.spacing].text)}">${letterheadHtml(letterhead)}${pageHtml()}</main>`,
      // Shared with the server's print page, so this PDF matches the creator's.
      pageSize: LETTER_PAGE_SIZE,
      pageMargin: LETTER_PAGE_MARGIN,
      css: LETTER_PRINT_CSS,
    });

  /** Under the name from the download dialog's field: `fileBase`, or what they changed it to. */
  async function download(format: DownloadFormat, name: string) {
    if (!letter.trim()) throw new Error("There's no letter to download yet.");
    if (format === "pdf") return printLetter(name);
    if (format === "docx") saveBlob(await coverToDocx(letter, letterhead, wordFontFor(design.font)), `${name}.docx`);
    else saveText(coverToMarkdown(letter, letterhead), `${name}.md`);
  }

  const openDownload = (format: DownloadFormat) => {
    setDownloadFormat(format);
    setDownloadOpen(true);
  };

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
          <p className="text-base font-bold text-primary">No cover letter with this one</p>
          <p className="mt-0.5 text-sm text-black/55">Plenty of forms don&apos;t ask for one. You can add it back any time before you track it.</p>
        </div>
        <StickerButton variant="outline" size="md" disabled={!editable} onClick={() => setSkipped(false)}>
          Add a letter after all
        </StickerButton>
      </DashCard>
    );
  }

  const nextIsRewrite = shown === tone;
  const hasLetter = shown !== null;
  const busy = cover.writing || revising;
  const tooLong = letter.length > APPLICATION_LIMITS.coverLetterMax;
  const surface = THEME_CANVAS_CLASS[design.theme];
  const body = cn(FONT_CLASS[design.font], SPACING_CLASS[design.spacing].text, "text-primary [&>p]:mb-4 last:[&>p]:mb-0");
  const pageHeader = letterhead ? (
    <div className="border-b border-black/10 px-8 pb-5 pt-7">
      <p className={cn("text-lg font-bold text-primary", FONT_CLASS[design.font])}>{letterhead.name}</p>
      {letterhead.contact.length > 0 && <p className="mt-0.5 text-xs text-black/45">{letterhead.contact.join(" · ")}</p>}
    </div>
  ) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <DashCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Half the width on a wide screen; a long resume name wraps onto the next line rather than being cut. */}
          <div className="min-w-0 max-w-full md:max-w-[50%]">
            <p className="text-base font-bold text-primary">Cover letter</p>
            <p className="mt-0.5 break-words text-sm text-black/55">Written from {resumeName ?? "your resume"} and this posting.</p>
          </div>
          {editable && (
            <StickerButton variant="outline" size="sm" className="ml-auto" onClick={() => setSkipped(true)}>
              <SkipForward className="h-3.5 w-3.5" />
              Skip
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
            {/* Free keeps one cover letter: the service refused another, and the popup has opened. */}
            {cover.failure.kind === "plan" && (
              <StickerButton variant="outline" size="sm" onClick={coverLock.upgrade}>
                Upgrade to Basic
              </StickerButton>
            )}
          </div>
        )}
      </DashCard>

      {hasLetter && writtenFrom && writtenFrom !== resumeId && shown !== "own" && (
        <p className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black/60">
          This letter was written from a different resume than the one you&apos;re sending now. Rewrite it so the two agree.
        </p>
      )}

      {/* Right above the letter box (owner, 2026-10-03): the tone for the next letter on the left; on the right,
          Generate in the brand's lime (what it costs is its tooltip), then Copy letter. */}
      {(editable || hasLetter) && (
        <div className="-mb-2 flex flex-wrap items-center justify-between gap-3">
          {editable && <SlidingTabs value={tone} options={TONE_OPTIONS} onChange={(next) => chooseTone(next as CoverTone)} />}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {editable && (
              <StickerButton
                variant="secondary"
                size="md"
                // An ink shadow on hover: a lime one would vanish into the lime button.
                className="[--br-c:#222325]"
                disabled={busy}
                title={`Writes ${nextIsRewrite ? "a new" : "a"} ${TONE_LABELS[tone].toLowerCase()} letter from your resume and this posting. ${COVER_CREDITS} credits.`}
                onClick={() => void write(tone)}>
                <Sparkles className="h-4 w-4" />
                Generate
              </StickerButton>
            )}
            {hasLetter && (
              <SplitButton
                label={copied ? "Copied" : "Copy letter"}
                icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                onClick={() => void copy()}
                items={[
                  { id: "pdf", label: "Download as PDF", icon: <Download className="h-3.5 w-3.5" />, onSelect: () => openDownload("pdf") },
                  { id: "docx", label: "Download as DOCX", icon: <Download className="h-3.5 w-3.5" />, onSelect: () => openDownload("docx") },
                  // The letter alone, not the page around it.
                  { id: "print", label: "Print", icon: <Printer className="h-3.5 w-3.5" />, onSelect: () => void printLetter() },
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* The letter, in the cover letter creator's editor: the look in the toolbar, the letterhead on the page.
          Before anything is written it holds a blank letter; typing into it makes it your own. */}
      {(editable || hasLetter) &&
        (editable ? (
          <RichTextEditor
            docKey={String(seed.key)}
            initialHtml={seed.html}
            onChange={({ text, html }) => onCoverChange((state) => ({ ...state, shown: state.shown ?? "own", letter: tidy(text), html, skipped: false }))}
            ariaLabel="Cover letter"
            toolbarLeading={
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <ToolbarSelect label="Theme" value={design.theme} options={THEME_OPTIONS} onChange={(v) => setDesign({ theme: v as LetterDesign["theme"] })} />
                <ToolbarSelect label="Font" value={design.font} options={LETTER_FONT_OPTIONS} onChange={(v) => setDesign({ font: v as LetterDesign["font"] })} />
                <ToolbarSelect
                  label="Spacing"
                  value={design.spacing}
                  options={SPACING_OPTIONS}
                  onChange={(v) => setDesign({ spacing: v as LetterDesign["spacing"] })}
                />
                <ToolbarSelect
                  label="Letterhead"
                  value={design.letterhead}
                  options={LETTERHEAD_OPTIONS}
                  onChange={(v) => setDesign({ letterhead: v as LetterDesign["letterhead"] })}
                />
              </div>
            }
            pageHeader={pageHeader}
            surfaceClassName={surface}
            contentClassName={body}
            busy={
              busy ? (
                <LetterSkeleton
                  paragraphs={TONE_PARAGRAPHS[tone]}
                  label={revising ? "Changing your letter" : `Writing your ${TONE_LABELS[tone].toLowerCase()} letter`}
                />
              ) : undefined
            }
          />
        ) : (
          // Tracked: the letter as it was sent, on the same page, and no longer editable.
          <div className={cn("overflow-hidden rounded-2xl", surface)}>
            {pageHeader}
            <div className={cn("px-8 py-7", body)} dangerouslySetInnerHTML={{ __html: pageHtml() }} />
          </div>
        ))}

      {hasLetter && (
        <DashCard className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold tabular-nums text-black/45">
              {wordsIn(letter)} words · {shown === "own" ? "your own" : TONE_LABELS[shown as CoverTone].toLowerCase()}
            </span>
            {tooLong && (
              <span className="text-xs font-semibold text-[#b23c26]">
                Longer than an application can hold ({letter.length.toLocaleString()} of {APPLICATION_LIMITS.coverLetterMax.toLocaleString()} characters). Shorten it
                before you track it.
              </span>
            )}
          </div>

          {editable && (
            <div className="border-t border-black/8 pt-4">
              <div className="flex items-center gap-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/12 bg-[#fbfbf7] px-3.5 py-2.5">
                  <Sparkles className="h-4 w-4 flex-none text-black/40" />
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void revise();
                    }}
                    maxLength={MAX_REVISE_INSTRUCTION_CHARS}
                    disabled={busy}
                    aria-label="Tell the AI how to change the letter"
                    placeholder={revising ? "Changing your letter…" : "Make it warmer, shorter, more specific…"}
                    className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-black/35"
                  />
                </div>
                <span className="hidden flex-none text-[11px] font-semibold text-black/45 sm:inline">{COVER_REVISE_CREDITS} credit</span>
                <StickerButton
                  variant="primary"
                  size="md"
                  onClick={() => void revise()}
                  disabled={!prompt.trim() || busy || !letter.trim()}
                  aria-label={revising ? "Changing the letter" : "Change the letter"}>
                  <Send className="h-4 w-4" />
                </StickerButton>
              </div>
              {reviseNote && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f0f0ea] px-3.5 py-2.5">
                  <p className="flex-1 text-xs leading-relaxed text-black/60">{reviseNote}</p>
                  <button
                    type="button"
                    onClick={() => setReviseNote(null)}
                    aria-label="Dismiss"
                    className="flex-none cursor-pointer text-black/35 hover:text-black/60">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </DashCard>
      )}

      <DownloadModal
        key={downloadFormat}
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        docLabel="cover letter"
        fileName={fileBase}
        defaultFormat={downloadFormat}
        onDownload={download}
      />
    </div>
  );
};

export default CoverStep;
