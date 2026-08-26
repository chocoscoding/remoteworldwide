"use client";

import { FC, ReactNode, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FileSearch, Repeat2, SendHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import { JD_QA_EXCHANGES, JD_QUICK_QUESTIONS } from "@/app/lib/dashboard/mock-data";
import type { JdQaAnswer } from "@/app/lib/dashboard/types";
import JobPickerDialog from "@/app/components/dashboard/jobs/JobPickerDialog";
import { PLATFORM_JOBS, createPastedJob, type JobOption } from "@/app/lib/dashboard/job-options";

// ---------------------------------------------------------------------------
// Chat entry shape + helpers — the transcript is a flat list of alternating
// user/coach entries. Quick-question chips and the free-text composer both
// just append onto the same local list; nothing here calls a real model.
// ---------------------------------------------------------------------------

type ChatEntry =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "coach"; verdict: string; missing: string; tips: string[] };

/** Canned reply used when the visitor types something outside the 4 quick prompts. */
const FALLBACK_ANSWER: Pick<JdQaAnswer, "verdict" | "missing" | "tips"> = {
  verdict:
    "Based on this JD and your profile, the strongest overlap is your design-systems and async-collaboration experience — that maps directly to what Vercel is screening for.",
  missing:
    "I don't have a tailored answer prepared for that exact question yet — try one of the prompts above for a sharper, JD-specific read.",
  tips: [
    "Name the developer-experience angle explicitly in your opening line — the JD repeats that phrase three times.",
    "Ask in the screen how design and engineering hand off work day to day — it tells you whether the async claim is real.",
  ],
};

function buildExchange(
  answer: Pick<JdQaAnswer, "question" | "verdict" | "missing" | "tips">,
  keyBase: string
): ChatEntry[] {
  return [
    { id: `${keyBase}-q`, role: "user", text: answer.question },
    { id: `${keyBase}-a`, role: "coach", verdict: answer.verdict, missing: answer.missing, tips: answer.tips },
  ];
}

/** Wraps the first occurrence of `highlight` inside `text` in a lime highlight span. */
function renderHighlightedJd(text: string, highlight: string): ReactNode {
  const idx = text.indexOf(highlight);
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + highlight.length);
  const after = text.slice(idx + highlight.length);
  return (
    <>
      {before}
      <span className="bg-secondary/70 text-primary rounded px-1 font-semibold">{match}</span>
      {after}
    </>
  );
}

const INITIAL_ANSWER = JD_QA_EXCHANGES.find((e) => e.id === "fit") ?? JD_QA_EXCHANGES[0];

const JdqaClient: FC = () => {
  // No job, no questions — this screen has nothing to say until one is picked,
  // so the picker is the default state rather than a job being assumed.
  const [job, setJob] = useState<JobOption | null>(null);
  const [jobs, setJobs] = useState<JobOption[]>(PLATFORM_JOBS);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [askedIds, setAskedIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const nextCustomId = useRef(0);

  function selectJob(next: JobOption) {
    setJob(next);
    setPickerOpen(false);
    // Every job starts its own conversation — carrying answers about a
    // different posting across would be worse than useless.
    setMessages(buildExchange(INITIAL_ANSWER, `seed-${next.id}`));
    setAskedIds(new Set(["fit"]));
    setComposerValue("");
  }

  function createJob(input: { company: string; role: string; jdText?: string; url?: string }) {
    const created = createPastedJob(input);
    setJobs((prev) => [created, ...prev]);
    selectJob(created);
  }

  function clearJob() {
    setJob(null);
    setMessages([]);
    setAskedIds(new Set());
    setComposerValue("");
  }

  const askQuick = (id: string) => {
    if (askedIds.has(id)) return;
    const entry = JD_QA_EXCHANGES.find((e) => e.id === id);
    if (!entry) return;
    setMessages((prev) => [...prev, ...buildExchange(entry, `${id}-${prev.length}`)]);
    setAskedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const submitComposer = () => {
    const text = composerValue.trim();
    if (!text) return;
    const key = `custom-${nextCustomId.current++}`;
    setMessages((prev) => [
      ...prev,
      { id: `${key}-q`, role: "user", text },
      { id: `${key}-a`, role: "coach", verdict: FALLBACK_ANSWER.verdict, missing: FALLBACK_ANSWER.missing, tips: FALLBACK_ANSWER.tips },
    ]);
    setComposerValue("");
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Ask about a job</h1>
          <span className="hidden sm:inline text-sm text-black/45 truncate">
            A straight read on any job description before you apply
          </span>
        </div>
        {job && (
          <div className="flex flex-none items-center gap-2">
            <StickerButton variant="outline" size="md" onClick={() => setPickerOpen(true)}>
              <Repeat2 className="h-4 w-4" />
              Change job
            </StickerButton>
            <button
              type="button"
              onClick={clearJob}
              aria-label="Clear this job"
              title="Clear this job"
              className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg border-[1.5px] border-[#222325] bg-white text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1240px] mx-auto">
        {!job ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0f0ea]">
              <FileSearch className="h-5 w-5 text-black/40" />
            </span>
            <h2 className="mt-5 text-xl font-bold text-primary">Which job are we reading?</h2>
            <p className="mt-2 max-w-[420px] text-sm leading-relaxed text-black/50">
              Pick a role from Remote Worldwide, or paste one in. Whatever you paste is saved to your jobs, so you can come back
              to it later.
            </p>
            <StickerButton variant="primary" size="md" className="mt-6" onClick={() => setPickerOpen(true)}>
              <FileSearch className="h-4 w-4" />
              Choose a job
            </StickerButton>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5 items-start">
          {/* Left: pasted job card */}
          <DashCard className="p-6 lg:sticky lg:top-24">
            <Pill variant="neutral" className="mb-4">
              {job.source === "pasted" ? "Pasted job" : "On Remote Worldwide"}
            </Pill>
            <p className="text-lg font-bold text-primary leading-snug">{job.role}</p>
            <p className="text-sm text-black/50 font-medium mb-4">{job.company}</p>
            {job.salary && (
              <Pill variant="positive" className="mb-5">
                {job.salary}
              </Pill>
            )}
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2">
              Full description
            </p>
            <p className="text-sm text-black/70 leading-relaxed">
              {job.highlight ? renderHighlightedJd(job.jdText, job.highlight) : job.jdText}
            </p>
          </DashCard>

          {/* Right: Q&A chat */}
          <DashCard className="p-0 flex flex-col overflow-hidden">
            {/* Quick-question chips */}
            <div className="p-5 border-b border-black/8">
              <p className="text-sm font-bold text-primary mb-3">Quick questions</p>
              <div className="flex flex-wrap gap-2">
                {JD_QUICK_QUESTIONS.map((q) => {
                  const asked = askedIds.has(q.id);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => askQuick(q.id)}
                      disabled={asked}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-default",
                        asked ? "bg-[#f0f0ea] text-black/35" : "border border-black/12 bg-white text-primary hover:border-primary"
                      )}>
                      {asked && <Check className="h-3 w-3" />}
                      {q.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transcript */}
            <div className="overflow-y-auto max-h-[520px] min-h-[360px] px-5 py-5 flex flex-col gap-5">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-white px-4 py-2.5 text-sm leading-relaxed">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <div className="h-8 w-8 flex-none rounded-full bg-secondary text-primary font-extrabold text-[11px] flex items-center justify-center mt-0.5">
                      RW
                    </div>
                    <div className="max-w-[85%] flex flex-col gap-3">
                      <div className="rounded-2xl rounded-tl-sm bg-[#f6f6f6] px-4 py-3">
                        <p className="text-sm text-black/80 leading-relaxed">{m.verdict}</p>
                      </div>

                      <div className="flex items-start gap-2 rounded-xl bg-[#fbfbf7] border border-black/8 px-3.5 py-3">
                        <AlertTriangle className="h-4 w-4 flex-none text-black/40 mt-0.5" />
                        <div>
                          <p className="text-[10.5px] font-bold text-black/45 uppercase tracking-[0.08em] mb-1">
                            What&apos;s missing
                          </p>
                          <p className="text-sm text-black/65 leading-relaxed">{m.missing}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10.5px] font-bold text-black/45 uppercase tracking-[0.08em] mb-1.5">
                          What I&apos;d do
                        </p>
                        <ol className="flex flex-col gap-1.5">
                          {m.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-black/75 leading-relaxed">
                              <span className="h-5 w-5 flex-none rounded-full bg-[#f0f0ea] text-[11px] font-bold text-primary flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              {tip}
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link href="/dashboard/resume">
                          <StickerButton variant="outline" size="sm">
                            Tailor resume
                          </StickerButton>
                        </Link>
                        <Link href="/dashboard/referrals">
                          <StickerButton variant="outline" size="sm">
                            Find a referral
                          </StickerButton>
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Composer */}
            <div className="p-4 border-t border-black/8 flex items-center gap-2.5">
              <input
                value={composerValue}
                onChange={(e) => setComposerValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitComposer();
                }}
                placeholder="Ask anything about this role…"
                className="flex-1 rounded-full border border-black/12 bg-[#f6f6f6] px-4 py-2.5 text-sm text-primary placeholder:text-black/40 focus:outline-none focus:border-primary/40"
              />
              <button
                type="button"
                onClick={submitComposer}
                disabled={!composerValue.trim()}
                className="h-10 w-10 flex-none rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-default">
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </DashCard>
        </div>
        )}
      </main>

      <JobPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        jobs={jobs}
        onPick={selectJob}
        onCreate={createJob}
      />
    </div>
  );
};

export default JdqaClient;
