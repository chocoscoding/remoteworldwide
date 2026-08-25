"use client";

// Picking what you're applying to.
//
// The wizard behind this was hardwired to one job, so there was no way to
// start an application for anything else. This is the missing front door, and
// it accepts the three shapes a job actually arrives in: a link someone sent
// you, a description pasted out of an email or a PDF, or something already
// saved here.
//
// The job-board import is mentioned once, quietly, at the bottom. It's the
// path we'd prefer people took, which is exactly why it shouldn't interrupt —
// someone who already has a link in their clipboard is mid-task, and a banner
// telling them to go somewhere else is a wall, not a shortcut.

import { useState, type FC, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Clipboard, Link2, Loader2, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import LogoMini from "@/app/components/svg/LogoMini";
import { looksLikeUrl, parseFreeText, parseJobUrl } from "@/app/lib/dashboard/parse-jd";
import { APPS } from "@/app/lib/dashboard/mock-data";

export interface StartedJob {
  company: string;
  role: string;
  jdText?: string;
  url?: string;
  /** How it got here, shown as a small provenance chip inside the wizard. */
  source: "link" | "paste" | "saved" | "board";
}

export interface StartApplicationProps {
  onStart: (job: StartedJob) => void;
}

type Mode = "link" | "paste" | "saved";

const MODES: { id: Mode; label: string; icon: typeof Link2; hint: string }[] = [
  { id: "link", label: "Job link", icon: Link2, hint: "Paste the URL of the posting." },
  { id: "paste", label: "Paste description", icon: Clipboard, hint: "Drop in the text of the job description." },
  { id: "saved", label: "Saved jobs", icon: Search, hint: "Something you already tracked here." },
];

const FIELD =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-black/40";

const StartApplication: FC<StartApplicationProps> = ({ onStart }) => {
  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function handleLink(e: FormEvent) {
    e.preventDefault();
    const input = url.trim();
    if (!input) return;

    // Free text typed into the link field still works rather than erroring.
    if (!looksLikeUrl(input)) {
      const parsed = parseFreeText(input);
      onStart({ ...parsed, source: "paste" });
      return;
    }

    setBusy(true);
    const res = await parseJobUrl(input);
    setBusy(false);
    if (res.ok) {
      onStart({ ...res.parsed, url: input, source: "link" });
    } else {
      // Never a dead end — fall through to the paste tab with the reason shown.
      setNote(res.reason);
      setMode("paste");
    }
  }

  function handlePaste(e: FormEvent) {
    e.preventDefault();
    const text = jd.trim();
    if (!text) return;
    // First line is usually "Company — Role"; everything else is the body.
    const [firstLine, ...rest] = text.split("\n");
    const parsed = parseFreeText(firstLine);
    onStart({
      company: parsed.company || "Untitled company",
      role: parsed.role || "Untitled role",
      jdText: rest.join("\n").trim() || text,
      source: "paste",
    });
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <h2 className="text-2xl font-bold text-primary">What are you applying to?</h2>
      <p className="mt-1.5 text-sm text-black/50">
        Bring the job in any shape — we&apos;ll pull out the company, the role and the description.
      </p>

      {/* Mode picker */}
      <div className="mt-6 flex flex-wrap gap-2">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setNote(null);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border-[1.5px] px-3.5 py-2 text-sm font-semibold transition-[transform,box-shadow,background-color] duration-100 ease-out cursor-pointer",
                active
                  ? "border-[#222325] bg-[#222325] text-white shadow-[2px_2px_0_0_#e1f073]"
                  : "border-black/15 bg-white text-black/60 hover:border-[#222325] hover:text-primary",
                "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              )}>
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      <DashCard className="mt-4 p-6">
        <p className="mb-4 text-xs text-black/45">{MODES.find((m) => m.id === mode)?.hint}</p>

        {note && <p className="mb-4 rounded-md border border-black/15 bg-[#fbfbf7] px-3 py-2 text-xs text-black/60">{note}</p>}

        {mode === "link" && (
          <form onSubmit={handleLink}>
            <label className="sr-only" htmlFor="apply-link">
              Job link
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/30" />
                <input
                  id="apply-link"
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://jobs.lever.co/…"
                  className={cn(FIELD, "pl-9")}
                />
              </div>
              <StickerButton variant="primary" size="md" type="submit" disabled={!url.trim() || busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy ? "Reading" : "Start"}
              </StickerButton>
            </div>
          </form>
        )}

        {mode === "paste" && (
          <form onSubmit={handlePaste}>
            <label className="sr-only" htmlFor="apply-jd">
              Job description
            </label>
            <textarea
              id="apply-jd"
              autoFocus
              rows={8}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder={"Stripe — Support Engineer\n\nPaste the rest of the description here…"}
              className={cn(FIELD, "resize-y leading-relaxed")}
            />
            <div className="mt-3 flex items-center gap-3">
              <StickerButton variant="primary" size="md" type="submit" disabled={!jd.trim()}>
                <ArrowRight className="h-4 w-4" />
                Start
              </StickerButton>
              <span className="text-xs text-black/40">First line is read as company and role.</span>
            </div>
          </form>
        )}

        {mode === "saved" && (
          <div className="flex flex-col gap-2">
            {APPS.map((a) => {
              const selected = savedId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSavedId(a.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors cursor-pointer",
                    selected ? "border-[#222325] bg-[#f6faea]" : "border-black/12 hover:bg-[#f6f6f6]"
                  )}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-primary">{a.title}</span>
                      {a.rww && <LogoMini className="h-3 w-3 flex-none" />}
                    </span>
                    <span className="block truncate text-xs text-black/45">{a.meta}</span>
                  </span>
                  {selected && <Pill variant="positive">Selected</Pill>}
                </button>
              );
            })}
            <div className="mt-2">
              <StickerButton
                variant="primary"
                size="md"
                disabled={!savedId}
                onClick={() => {
                  const a = APPS.find((x) => x.id === savedId);
                  if (!a) return;
                  // `meta` carries the company alongside other details.
                  const company = a.meta.split("·")[0].trim();
                  onStart({ company, role: a.title, source: "saved" });
                }}>
                <ArrowRight className="h-4 w-4" />
                Start
              </StickerButton>
            </div>
          </div>
        )}
      </DashCard>

      {/* The board import. One line, below the fold of the task, and phrased as
          a shortcut rather than a redirect. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-black/45">
        <Sparkles className="h-3.5 w-3.5 flex-none text-black/30" />
        <span>Applying to something on our board?</span>
        <Link href="/jobs" className="font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
          Import it in one step
        </Link>
        <span>— the description and salary come across filled in.</span>
      </div>
    </div>
  );
};

export default StartApplication;
