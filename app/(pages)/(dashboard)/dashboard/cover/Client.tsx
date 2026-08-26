"use client";

import { FC, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FileSignature,
  Link2,
  Printer,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import DownloadModal from "@/app/components/dashboard/modals/DownloadModal";
import RichTextEditor from "@/app/components/dashboard/ui/RichTextEditor";
import SplitButton from "@/app/components/dashboard/ui/SplitButton";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import JobPickerDialog from "@/app/components/dashboard/jobs/JobPickerDialog";
import { PLATFORM_JOBS, createPastedJob, type JobOption } from "@/app/lib/dashboard/job-options";
import { COVER_LETTER, RESUME } from "@/app/lib/dashboard/mock-data";

// ---------------------------------------------------------------------------
// Local content that isn't shared with any other screen yet — kept here
// rather than in mock-data.ts, mirroring the pattern in dashboard/Client.tsx.
// ---------------------------------------------------------------------------

type ToneId = "warm" | "formal" | "story" | "short";
type ThemeId = "ats" | "bordered" | "warm";
type FontId = "manrope" | "serif" | "mono";
type SpacingId = "tight" | "normal" | "airy";
type LetterheadId = "off" | "name" | "full";

const TONE_OPTIONS: { id: ToneId; label: string }[] = [
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

/**
 * Tone genuinely rewrites the letter — same facts, different register and
 * length. Previously these chips only moved a highlight, which made the
 * control a lie: picking "Short" left a four-paragraph letter on screen.
 */
const TONE_LETTERS: Record<ToneId, { greeting: string; paragraphs: string[] }> = {
  warm: {
    greeting: "Hi Deel team,",
    paragraphs: [
      "I've spent the last three years designing payment and compliance flows for merchants across 30+ countries at Paystack — work that only exists because someone has to make cross-border money movement feel simple, which is exactly the problem Deel is solving for global teams.",
      "Most recently I led a checkout redesign that cut failed-payment support tickets by 31%, and I built the internal design-system documentation that 40+ engineers now rely on weekly. Both projects meant translating regulatory and technical constraints into interfaces regular people trust with their money — the same tension I imagine shows up constantly in global payroll.",
      "I work async by default, across a four-hour overlap with most US teams, and I'd love to bring that discipline to Deel's design team.",
    ],
  },
  formal: {
    greeting: "Dear Hiring Manager,",
    paragraphs: [
      "I am writing to apply for the Senior Designer position at Deel. For the past three years I have designed payment and compliance flows serving merchants in more than 30 countries at Paystack, work closely aligned with the cross-border challenges Deel addresses for distributed organisations.",
      "In my current role I led a checkout redesign that reduced failed-payment support tickets by 31%, and I established the internal design-system documentation now used weekly by over 40 engineers. Both required translating regulatory and technical constraints into interfaces that customers trust with their money.",
      "I work asynchronously across a four-hour overlap with US-based teams and would welcome the opportunity to discuss how that experience could serve Deel's design function.",
      "Thank you for your consideration.",
    ],
  },
  story: {
    greeting: "Hi Deel team,",
    paragraphs: [
      "A merchant in Accra once told me she'd stopped trusting her own checkout page. She couldn't tell which payments had failed, or why. That conversation reshaped three years of my work at Paystack.",
      "I rebuilt that flow end to end. Failed-payment support tickets dropped 31%, and the pattern became the reference other teams copied — which is how I ended up writing the design-system documentation 40+ engineers now open every week.",
      "What stayed with me is that the hard part was never the interface. It was carrying regulatory and technical constraints without passing the confusion on to the person holding the money. That's the tension I see in global payroll, and it's why Deel is the team I want to do this next to.",
      "I work async by default, across a four-hour overlap with most US teams.",
    ],
  },
  short: {
    greeting: "Hi Deel team,",
    paragraphs: [
      "Three years designing payment and compliance flows at Paystack, for merchants across 30+ countries — the same cross-border problem Deel solves for global teams.",
      "I led a checkout redesign that cut failed-payment tickets 31%, and wrote the design-system docs 40+ engineers use weekly. I work async across a four-hour US overlap.",
      "I'd welcome a conversation.",
    ],
  },
};

const STRONG_TITLE = "Your strongest line: a decision, a number and an outcome";
const SUGG_TITLE = "Consider a plainer connector than the em dash";

/**
 * Inline markers, the way Grammarly draws them: the strongest line gets a
 * lime highlight, and em-dash constructions get a green underline with the
 * suggestion on hover. Baked into the seeded HTML so the marks live inside
 * the editable text and survive editing around them.
 */
function decorateParagraph(p: string): string {
  return p
    .split(/(?<=[.!?])\s+/)
    .map((sent) => {
      let out = sent.replace(/(\S+ — \S+)/g, `<span class="sugg" title="${SUGG_TITLE}">$1</span>`);
      if (sent.includes("31%")) out = `<mark title="${STRONG_TITLE}">${out}</mark>`;
      return out;
    })
    .join(" ");
}

/**
 * The tone letters are authored against Deel; swap the company (and, in the
 * formal letter, the role title) for whichever job is linked so the draft
 * reads coherently. The surrounding facts stay Amara's — a real generator is
 * the seam this stands in for.
 */
function personalize(text: string, company: string, role: string): string {
  return text.replace(/Deel/g, company).replace("Senior Designer position", `${role} position`);
}

/** Paragraphs -> the HTML the editor loads. */
function lettersToHtml(greeting: string, paragraphs: string[], signOff: string): string {
  const body = paragraphs.filter((p) => p.trim()).map((p) => `<p>${decorateParagraph(p)}</p>`).join("");
  return `<p>${greeting}</p>${body}<p><strong>${signOff}</strong></p>`;
}

interface ProfileJdPull {
  id: string;
  label: string;
  profile: string;
  jd: string;
}

const PROFILE_JD_PULLS: ProfileJdPull[] = [
  {
    id: "pull-experience",
    label: "Relevant experience",
    profile: "3 years designing payment & compliance flows at Paystack",
    jd: "Deel needs someone comfortable with global payroll compliance flows",
  },
  {
    id: "pull-outcome",
    label: "Quantified outcome",
    profile: "Checkout redesign cut failed-payment tickets by 31%",
    jd: "JD asks for measurable impact on customer-facing money flows",
  },
  {
    id: "pull-systems",
    label: "Systems thinking",
    profile: "Built design-system docs used by 40+ engineers weekly",
    jd: "Deel's design team values documentation other teams can self-serve",
  },
  {
    id: "pull-async",
    label: "Way of working",
    profile: "Works async across a four-hour overlap with most US teams",
    jd: "Deel is a fully distributed team spanning many time zones",
  },
];

// A brand-new, blank draft that isn't tied to any job — used when the user
// starts "+ New cover letter" instead of tailoring the linked one.
const BLANK_LETTER: typeof COVER_LETTER = {
  company: "",
  role: "",
  draftLabel: "Untitled",
  greeting: "Hi there,",
  paragraphs: ["Start writing your cover letter here…", "", ""],
  signOff: RESUME.name,
  wordCount: 6,
};

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
  // JD link row
  const [tailoring, setTailoring] = useState(false);
  const [justTailored, setJustTailored] = useState(false);

  // Blank draft — true when the user started "+ New cover letter" instead of
  // using the JD-tailored letter. Local mock state only.
  const [isBlankDraft, setIsBlankDraft] = useState(false);

  // Disclosure + tone
  const [builtOpen, setBuiltOpen] = useState(false);
  const [tone, setTone] = useState<ToneId>("warm");

  // Style controls
  const [theme, setTheme] = useState<ThemeId>("ats");
  const [font, setFont] = useState<FontId>("manrope");
  const [spacing, setSpacing] = useState<SpacingId>("normal");
  const [letterhead, setLetterhead] = useState<LetterheadId>("off");

  // Letter canvas interactions

  // Footer
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Download modal
  const [downloadOpen, setDownloadOpen] = useState(false);

  // The job this letter is written for. Picking one is the only way in —
  // pasting a JD now happens inside the picker, alongside the platform's own
  // listings, instead of behind a separate "New cover letter" button.
  const [jobs, setJobs] = useState<JobOption[]>(PLATFORM_JOBS);
  // Nobody arrives with a letter. The default state is the choice: write
  // your own, or create one from a job — nothing pre-linked, nothing assumed.
  const [linkedJob, setLinkedJob] = useState<JobOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Live editor contents. Seeded from the tone, then owned by the user.
  const [letterText, setLetterText] = useState("");

  // Either path counts as having begun; until then the page shows the choice.
  const started = isBlankDraft || linkedJob !== null;

  const activeLetter = isBlankDraft ? BLANK_LETTER : COVER_LETTER;
  const toneLetter = TONE_LETTERS[tone];
  // Changing tone or starting a blank draft loads new content into the editor;
  // anything else leaves the user's typing alone.
  const docKey = isBlankDraft ? "blank" : `${tone}-${linkedJob?.id ?? "none"}`;
  const letterCompany = linkedJob?.company ?? COVER_LETTER.company;
  const letterRole = linkedJob?.role ?? COVER_LETTER.role;
  const initialHtml = isBlankDraft
    ? lettersToHtml(BLANK_LETTER.greeting, BLANK_LETTER.paragraphs, BLANK_LETTER.signOff)
    : lettersToHtml(
        personalize(toneLetter.greeting, letterCompany, letterRole),
        toneLetter.paragraphs.map((para) => personalize(para, letterCompany, letterRole)),
        COVER_LETTER.signOff
      );
  const liveWordCount = letterText.trim() ? letterText.trim().split(/\s+/).length : 0;
  const spacingCfg = SPACING_CLASS[spacing];

  const composeLetterText = () => {
    const lines: string[] = [];
    if (letterhead !== "off") {
      lines.push(RESUME.name);
      if (letterhead === "full") lines.push(`${RESUME.email} · ${RESUME.portfolio} · ${RESUME.location}`);
      lines.push("");
    }
    // What's actually on the page — the editor owns the body once mounted.
    const body = letterText.trim()
      ? letterText
      : [activeLetter.greeting, "", ...toneLetter.paragraphs.flatMap((para) => [para, ""]), activeLetter.signOff].join("\n");
    lines.push(body);
    return lines.join("\n");
  };

  const handleCopy = async () => {
    const text = composeLetterText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard permission may be unavailable in some environments —
      // still show the confirmed state since there's nothing else to do.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleTailor = () => {
    setTailoring(true);
    window.setTimeout(() => {
      setTailoring(false);
      setJustTailored(true);
      window.setTimeout(() => setJustTailored(false), 2200);
    }, 900);
  };

  const handleAiSubmit = () => {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    // No model behind this — acknowledge the ask honestly instead of faking a rewrite.
    setAiStatus(`Noted: "${prompt}". AI rewriting isn't wired up in this build — edit the letter directly above.`);
    setAiPrompt("");
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary truncate">
            {!started ? "Cover letters" : isBlankDraft ? "Cover letter — New draft" : `Cover letter — ${linkedJob!.company}, ${linkedJob!.role}`}
          </h1>
          {started && (
            <Pill variant="neutral" className="flex-none">
              {activeLetter.draftLabel}
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
              { id: "docx", label: "Download as DOCX", icon: <Download className="h-3.5 w-3.5" />, onSelect: () => setDownloadOpen(true) },
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
            <h2 className="text-2xl font-bold text-primary">Start a cover letter</h2>
            <p className="mt-2 max-w-[440px] text-sm leading-relaxed text-black/50">
              Tailor one to a specific job, or just start typing — a letter doesn&apos;t need a job attached.
            </p>
            <div className="mt-7 grid w-full max-w-[560px] grid-cols-1 gap-3.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="group rounded-2xl border-[1.5px] border-[#222325] bg-[#222325] p-5 text-left text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[3px_3px_0_0_#e1f073] hover:shadow-[4px_4px_0_0_#e1f073] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
                <span className="grid h-9 w-9 place-content-center rounded-lg bg-white/10">
                  <Link2 className="h-4 w-4 text-[#e1f073]" />
                </span>
                <span className="mt-3 block text-sm font-bold">Create from a job</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/55">
                  Pick a Remote Worldwide listing or paste any posting — we draft it tailored.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsBlankDraft(true)}
                className="group rounded-2xl border-[1.5px] border-black/15 bg-white p-5 text-left cursor-pointer transition-[transform,box-shadow,border-color] duration-100 ease-out hover:border-[#222325] hover:shadow-[4px_4px_0_0_#222325] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
                <span className="grid h-9 w-9 place-content-center rounded-lg bg-[#f0f0ea]">
                  <FileSignature className="h-4 w-4 text-primary" />
                </span>
                <span className="mt-3 block text-sm font-bold text-primary">Write your own</span>
                <span className="mt-1 block text-xs leading-relaxed text-black/50">
                  A blank page, no job attached. You can link one later.
                </span>
              </button>
            </div>
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
                  {justTailored && <span className="text-xs font-semibold text-[#6c7a1e]">Retailored ✓</span>}
                </>
              ) : (
                <span className="text-sm text-black/50">Not linked to a job — pick one to tailor this letter.</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-none">
              {!isBlankDraft && (
                <StickerButton variant="outline" size="sm" onClick={() => { setIsBlankDraft(true); setLetterText(""); }}>
                  <FileSignature className="h-3.5 w-3.5" />
                  Write from scratch
                </StickerButton>
              )}
              <StickerButton variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                <Link2 className="h-3.5 w-3.5" />
                {linkedJob && !isBlankDraft ? "Change job" : "Pick a job"}
              </StickerButton>
              <StickerButton variant="primary" size="sm" onClick={handleTailor} disabled={tailoring || !linkedJob || isBlankDraft}>
                <RefreshCw className={cn("h-3.5 w-3.5", tailoring && "animate-spin")} />
                {tailoring ? "Tailoring…" : "Tailor letter"}
              </StickerButton>
            </div>
          </div>
        </DashCard>

        {/* Disclosure toggle + tone chips */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isBlankDraft ? (
            <span className="text-sm font-semibold text-black/35">Blank draft — not linked to a job</span>
          ) : (
            <button
              type="button"
              onClick={() => setBuiltOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline cursor-pointer">
              Built from your profile + this job
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", builtOpen && "rotate-180")} />
            </button>
          )}

          <SlidingTabs value={tone} options={TONE_OPTIONS} onChange={setTone} />
        </div>

        {/* Expandable disclosure panel */}
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            builtOpen && !isBlankDraft ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0"
          )}>
          <DashCard className="p-6 flex flex-col gap-6">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-3">
                Pulled from your profile, matched to this JD
              </p>
              <div className="flex flex-col divide-y divide-black/8">
                {PROFILE_JD_PULLS.map((pull) => (
                  <div key={pull.id} className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                    <p className="text-xs font-bold text-black/40 sm:pt-0.5">{pull.label}</p>
                    <p className="text-sm text-primary">{pull.profile}</p>
                    <p className="text-sm text-black/50">{pull.jd}</p>
                  </div>
                ))}
              </div>
            </div>

          </DashCard>
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
              <ToolbarSelect label="Letterhead" value={letterhead} options={LETTERHEAD_OPTIONS} onChange={(v) => setLetterhead(v as LetterheadId)} />
            </div>
          }
          pageHeader={
            letterhead !== "off" ? (
              <div className="border-b border-black/10 px-8 pb-5 pt-7">
                <p className={cn("text-lg font-bold text-primary", FONT_CLASS[font])}>{RESUME.name}</p>
                {letterhead === "full" && (
                  <p className="mt-0.5 text-xs text-black/45">
                    {RESUME.email} · {RESUME.portfolio} · {RESUME.location}
                  </p>
                )}
              </div>
            ) : undefined
          }
          surfaceClassName={THEME_CANVAS_CLASS[theme]}
          contentClassName={cn(
            FONT_CLASS[font],
            spacingCfg.text,
            "text-primary [&>p]:mb-4 last:[&>p]:mb-0",
            // Inline markers, Grammarly-style: highlight for the strongest
            // line, green underline for a suggested change.
            "[&_mark]:bg-[#e1f073]/70 [&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:cursor-help",
            "[&_.sugg]:underline [&_.sugg]:decoration-[#3fa66a] [&_.sugg]:decoration-2 [&_.sugg]:underline-offset-4 [&_.sugg]:cursor-help"
          )}
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
                  <Pill variant="neutral">≈55 sec read</Pill>
                  <Pill variant="neutral">92% match to {COVER_LETTER.company}&apos;s JD keywords</Pill>
                  <Pill variant="neutral">Strongest line: paragraph 2, the 31% stat</Pill>
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
                <Pill variant="outline-dashed" className="flex-none">
                  1 credit
                </Pill>
              </div>
              <StickerButton variant="primary" size="md" onClick={handleAiSubmit} disabled={!aiPrompt.trim()}>
                <Send className="h-4 w-4" />
              </StickerButton>
            </div>

            {aiStatus && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f0f0ea] px-3.5 py-2.5">
                <p className="text-xs text-black/60 leading-relaxed flex-1">{aiStatus}</p>
                <button type="button" onClick={() => setAiStatus(null)} className="flex-none text-black/35 hover:text-black/60 cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </DashCard>
          </>
        )}
      </main>

      <JobPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        jobs={jobs}
        onPick={(j) => {
          setLinkedJob(j);
          setIsBlankDraft(false);
          setPickerOpen(false);
        }}
        onCreate={(input) => {
          const created = createPastedJob(input);
          setJobs((prev) => [created, ...prev]);
          setLinkedJob(created);
          setIsBlankDraft(false);
          setPickerOpen(false);
        }}
      />

      <DownloadModal open={downloadOpen} onOpenChange={setDownloadOpen} docLabel="cover letter" fileName="Amara-Okafor-Cover-Letter" />
    </div>
  );
};

export default CoverClient;
