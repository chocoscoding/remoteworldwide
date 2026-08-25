"use client";

import { FC, useState } from "react";
import {
  AlignLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileSignature,
  Link2,
  Palette,
  Plus,
  Quote,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Type,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import DownloadModal from "@/app/components/dashboard/modals/DownloadModal";
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
type ControlKey = "theme" | "font" | "spacing" | "letterhead";

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

const ALT_OPENING =
  "Deel is solving, at global scale, the exact problem I've spent three years living inside at Paystack — making cross-border money move simply for people who never see the complexity behind it.";

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

const CoverClient: FC = () => {
  // JD link row
  const [jdLinked, setJdLinked] = useState(true);
  const [jdDraft, setJdDraft] = useState("");
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
  const [openControl, setOpenControl] = useState<ControlKey | null>(null);

  // Letter canvas interactions
  const [usingAltOpening, setUsingAltOpening] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);

  // Footer
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Download modal
  const [downloadOpen, setDownloadOpen] = useState(false);

  const activeLetter = isBlankDraft ? BLANK_LETTER : COVER_LETTER;
  const openingParagraph = !isBlankDraft && usingAltOpening ? ALT_OPENING : activeLetter.paragraphs[0];
  const spacingCfg = SPACING_CLASS[spacing];

  const composeLetterText = () => {
    const lines: string[] = [];
    if (letterhead !== "off") {
      lines.push(RESUME.name);
      if (letterhead === "full") lines.push(`${RESUME.email} · ${RESUME.portfolio} · ${RESUME.location}`);
      lines.push("");
    }
    lines.push(activeLetter.greeting, "");
    lines.push(openingParagraph, "");
    lines.push(activeLetter.paragraphs[1], "");
    lines.push(activeLetter.paragraphs[2], "");
    lines.push(activeLetter.signOff);
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

  const handleLinkJob = () => {
    if (!jdDraft.trim()) return;
    setJdLinked(true);
    setJdDraft("");
    setIsBlankDraft(false);
  };

  const handleNewDraft = () => {
    // Reset to a brand-new, blank letter that isn't tied to any job — clears
    // the JD link and every transient interaction tied to the old letter.
    setIsBlankDraft(true);
    setJdLinked(false);
    setJdDraft("");
    setUsingAltOpening(false);
    setAltOpen(false);
    setMarkOpen(false);
    setBuiltOpen(false);
    setDetailsOpen(false);
    setOpenControl(null);
    setAiPrompt("");
    setAiStatus(null);
    setCopied(false);
    setTailoring(false);
    setJustTailored(false);
  };

  const handleAiSubmit = () => {
    if (!aiPrompt.trim()) return;
    setAiStatus(`Rewrite requested: "${aiPrompt.trim()}" — 1 credit used. We'll apply it to your next draft.`);
    setAiPrompt("");
    window.setTimeout(() => setAiStatus(null), 4000);
  };

  const selectedTheme = THEME_OPTIONS.find((t) => t.id === theme)!;
  const selectedFont = FONT_OPTIONS.find((f) => f.id === font)!;
  const selectedSpacing = SPACING_OPTIONS.find((s) => s.id === spacing)!;
  const selectedLetterhead = LETTERHEAD_OPTIONS.find((l) => l.id === letterhead)!;

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary truncate">
            {isBlankDraft ? "Cover letter — New draft" : `Cover letter — ${COVER_LETTER.company}, ${COVER_LETTER.role}`}
          </h1>
          <Pill variant="neutral" className="flex-none">
            {activeLetter.draftLabel}
          </Pill>
        </div>
        <div className="flex items-center gap-2.5 flex-none">
          <StickerButton variant="outline" size="md" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy text"}
          </StickerButton>
          <StickerButton variant="primary" size="md" onClick={() => setDownloadOpen(true)}>
            <Download className="h-4 w-4" />
            Download
          </StickerButton>
        </div>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[760px] mx-auto flex flex-col gap-5">
        {/* JD-link row */}
        <DashCard className="p-4">
          {jdLinked ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-9 w-9 flex-none rounded-full bg-[#f0f0ea] flex items-center justify-center">
                <Link2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                <span className="text-sm text-black/50">Linked to</span>
                <Pill variant="active">
                  {COVER_LETTER.company} · {COVER_LETTER.role}
                </Pill>
                {justTailored && <span className="text-xs font-semibold text-[#6c7a1e]">Retailored ✓</span>}
              </div>
              <div className="flex items-center gap-2 flex-none">
                <StickerButton variant="outline" size="sm" onClick={handleNewDraft}>
                  <Plus className="h-3.5 w-3.5" />
                  New cover letter
                </StickerButton>
                <StickerButton variant="outline" size="sm" onClick={() => setJdLinked(false)}>
                  Replace
                </StickerButton>
                <StickerButton variant="primary" size="sm" onClick={handleTailor} disabled={tailoring}>
                  <RefreshCw className={cn("h-3.5 w-3.5", tailoring && "animate-spin")} />
                  {tailoring ? "Tailoring…" : "Tailor letter"}
                </StickerButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="jd-paste" className="text-xs font-semibold text-black/50">
                  Paste a job URL or the full description
                </label>
                <StickerButton variant="outline" size="sm" className="flex-none" onClick={handleNewDraft}>
                  <Plus className="h-3.5 w-3.5" />
                  New cover letter
                </StickerButton>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  id="jd-paste"
                  type="text"
                  value={jdDraft}
                  onChange={(e) => setJdDraft(e.target.value)}
                  placeholder="https://... or paste the job description text"
                  className="flex-1 min-w-[220px] rounded-xl border border-black/12 bg-[#fbfbf7] px-3.5 py-2.5 text-sm text-primary placeholder:text-black/35 outline-none focus:border-black/30 transition-colors"
                />
                <StickerButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setJdLinked(true);
                    setJdDraft("");
                    setIsBlankDraft(false);
                  }}>
                  Cancel
                </StickerButton>
                <StickerButton variant="primary" size="sm" onClick={handleLinkJob} disabled={!jdDraft.trim()}>
                  Link job
                </StickerButton>
              </div>
            </div>
          )}
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

          <div className="flex flex-wrap items-center gap-1.5">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                  tone === t.id ? "bg-[#222325] text-white" : "bg-[#f0f0ea] text-black/55 hover:bg-[#e7e7df]"
                )}>
                {t.label}
              </button>
            ))}
          </div>
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

            <div className="border-t border-black/8 pt-5">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-3">Style this letter</p>
              <div className="flex flex-wrap gap-2.5">
                {/* Theme */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenControl((v) => (v === "theme" ? null : "theme"))}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold cursor-pointer transition-colors",
                      openControl === "theme" ? "border-primary bg-[#f6f6f6]" : "border-black/12 bg-white hover:border-black/25"
                    )}>
                    <Palette className="h-3.5 w-3.5 text-black/50" />
                    <span className="text-black/45">Theme:</span>
                    <span className="text-primary">{selectedTheme.label}</span>
                    <ChevronDown className={cn("h-3 w-3 text-black/40 transition-transform", openControl === "theme" && "rotate-180")} />
                  </button>
                  {openControl === "theme" && (
                    <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-44 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden">
                      {THEME_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setTheme(opt.id);
                            setOpenControl(null);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold transition-colors cursor-pointer",
                            opt.id === theme ? "bg-[#f6f6f6] text-primary" : "text-black/60 hover:bg-[#f9f9f6]"
                          )}>
                          {opt.label}
                          {opt.id === theme && <Check className="h-3.5 w-3.5 flex-none" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Font */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenControl((v) => (v === "font" ? null : "font"))}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold cursor-pointer transition-colors",
                      openControl === "font" ? "border-primary bg-[#f6f6f6]" : "border-black/12 bg-white hover:border-black/25"
                    )}>
                    <Type className="h-3.5 w-3.5 text-black/50" />
                    <span className="text-black/45">Font:</span>
                    <span className="text-primary">{selectedFont.label}</span>
                    <ChevronDown className={cn("h-3 w-3 text-black/40 transition-transform", openControl === "font" && "rotate-180")} />
                  </button>
                  {openControl === "font" && (
                    <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-40 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden">
                      {FONT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setFont(opt.id);
                            setOpenControl(null);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold transition-colors cursor-pointer",
                            opt.id === font ? "bg-[#f6f6f6] text-primary" : "text-black/60 hover:bg-[#f9f9f6]"
                          )}>
                          {opt.label}
                          {opt.id === font && <Check className="h-3.5 w-3.5 flex-none" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Spacing */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenControl((v) => (v === "spacing" ? null : "spacing"))}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold cursor-pointer transition-colors",
                      openControl === "spacing" ? "border-primary bg-[#f6f6f6]" : "border-black/12 bg-white hover:border-black/25"
                    )}>
                    <AlignLeft className="h-3.5 w-3.5 text-black/50" />
                    <span className="text-black/45">Spacing:</span>
                    <span className="text-primary">{selectedSpacing.label}</span>
                    <ChevronDown className={cn("h-3 w-3 text-black/40 transition-transform", openControl === "spacing" && "rotate-180")} />
                  </button>
                  {openControl === "spacing" && (
                    <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-40 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden">
                      {SPACING_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSpacing(opt.id);
                            setOpenControl(null);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold transition-colors cursor-pointer",
                            opt.id === spacing ? "bg-[#f6f6f6] text-primary" : "text-black/60 hover:bg-[#f9f9f6]"
                          )}>
                          {opt.label}
                          {opt.id === spacing && <Check className="h-3.5 w-3.5 flex-none" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Letterhead */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenControl((v) => (v === "letterhead" ? null : "letterhead"))}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold cursor-pointer transition-colors",
                      openControl === "letterhead" ? "border-primary bg-[#f6f6f6]" : "border-black/12 bg-white hover:border-black/25"
                    )}>
                    <FileSignature className="h-3.5 w-3.5 text-black/50" />
                    <span className="text-black/45">Letterhead:</span>
                    <span className="text-primary">{selectedLetterhead.label}</span>
                    <ChevronDown className={cn("h-3 w-3 text-black/40 transition-transform", openControl === "letterhead" && "rotate-180")} />
                  </button>
                  {openControl === "letterhead" && (
                    <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-44 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden">
                      {LETTERHEAD_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setLetterhead(opt.id);
                            setOpenControl(null);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold transition-colors cursor-pointer",
                            opt.id === letterhead ? "bg-[#f6f6f6] text-primary" : "text-black/60 hover:bg-[#f9f9f6]"
                          )}>
                          {opt.label}
                          {opt.id === letterhead && <Check className="h-3.5 w-3.5 flex-none" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DashCard>
        </div>

        {/* Letter canvas */}
        <div className={cn("relative rounded-2xl p-8 sm:p-10", THEME_CANVAS_CLASS[theme])}>
          {theme === "warm" && <div aria-hidden className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl bg-[#f0c86a]" />}

          <div className={cn("flex flex-col", spacingCfg.gap, FONT_CLASS[font])}>
            {letterhead !== "off" && (
              <div className="mb-1">
                <p className="text-base font-bold text-primary">{RESUME.name}</p>
                {letterhead === "full" && (
                  <p className="text-xs text-black/45 mt-0.5">
                    {RESUME.email} · {RESUME.portfolio} · {RESUME.location}
                  </p>
                )}
              </div>
            )}

            <p contentEditable suppressContentEditableWarning className={cn("text-primary outline-none", spacingCfg.text)}>
              {activeLetter.greeting}
            </p>

            {/* Opening paragraph — hover popover with "alt phrasing" (only relevant once a job is linked) */}
            <div className="relative" onMouseEnter={() => setAltOpen(true)} onMouseLeave={() => setAltOpen(false)}>
              <p contentEditable suppressContentEditableWarning className={cn("text-black/80 outline-none", spacingCfg.text)}>
                {openingParagraph}
              </p>

              {altOpen && !isBlankDraft && (
                <div className="absolute left-0 top-full mt-2 z-20 w-72 rounded-xl border border-black/10 bg-white shadow-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Quote className="h-3.5 w-3.5 text-black/40" />
                    <p className="text-xs font-bold text-primary">Try a different opening</p>
                  </div>
                  <p className="text-xs text-black/55 leading-relaxed mb-3">
                    {usingAltOpening
                      ? "You're using the alt phrasing. Swap back to the original opening line."
                      : "A tighter version that leads with Deel's problem instead of your résumé."}
                  </p>
                  <StickerButton
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setUsingAltOpening((v) => !v);
                      setAltOpen(false);
                    }}>
                    Swap opening line
                  </StickerButton>
                </div>
              )}
            </div>

            {/* Second paragraph — margin "strongest line" marker (only relevant once a job is linked) */}
            <div className="relative pr-8">
              <p contentEditable suppressContentEditableWarning className={cn("text-black/80 outline-none", spacingCfg.text)}>
                {activeLetter.paragraphs[1]}
              </p>

              {!isBlankDraft && (
                <button
                  type="button"
                  onMouseEnter={() => setMarkOpen(true)}
                  onMouseLeave={() => setMarkOpen(false)}
                  className="absolute right-0 top-0 h-6 w-6 rounded-full bg-secondary text-primary flex items-center justify-center cursor-default">
                  <Star className="h-3.5 w-3.5" fill="currentColor" />
                </button>
              )}

              {markOpen && !isBlankDraft && (
                <div className="absolute right-0 top-7 z-20 w-56 rounded-xl border border-black/10 bg-white shadow-lg p-3.5">
                  <p className="text-xs font-bold text-primary mb-1">Your strongest line</p>
                  <p className="text-xs text-black/55 leading-relaxed">
                    Leads with a hard number reviewers can verify — this is the sentence most likely to get a second read.
                  </p>
                </div>
              )}
            </div>

            <p contentEditable suppressContentEditableWarning className={cn("text-black/80 outline-none", spacingCfg.text)}>
              {activeLetter.paragraphs[2]}
            </p>

            <p contentEditable suppressContentEditableWarning className={cn("text-primary font-semibold outline-none", spacingCfg.text)}>
              {activeLetter.signOff}
            </p>
          </div>
        </div>

        {/* Footer: word count, details, AI rewrite */}
        <DashCard className="p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-black/45">{activeLetter.wordCount} words</span>
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
      </main>

      <DownloadModal open={downloadOpen} onOpenChange={setDownloadOpen} docLabel="cover letter" fileName="Amara-Okafor-Cover-Letter" />
    </div>
  );
};

export default CoverClient;
