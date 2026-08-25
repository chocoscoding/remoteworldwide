"use client";

import { FC, ReactNode, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ClipboardPaste, SendHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import { JD_CONTENT, JD_QA_EXCHANGES, JD_QUICK_QUESTIONS } from "@/app/lib/dashboard/mock-data";
import type { JdQaAnswer } from "@/app/lib/dashboard/types";

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
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [askedIds, setAskedIds] = useState<Set<string>>(new Set(["fit"]));
  const [messages, setMessages] = useState<ChatEntry[]>(() => buildExchange(INITIAL_ANSWER, "seed"));
  const [composerValue, setComposerValue] = useState("");
  const nextCustomId = useRef(0);

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
        <StickerButton variant="outline" size="md" onClick={() => setPasteOpen((v) => !v)}>
          <ClipboardPaste className="h-4 w-4" />
          Paste another job
        </StickerButton>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1240px] mx-auto">
        {/* Paste-another-job expandable panel */}
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            pasteOpen ? "max-h-[320px] opacity-100 mb-5" : "max-h-0 opacity-0"
          )}>
          <DashCard className="p-5 bg-[#fbfbf7]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-primary">Paste a new job description</p>
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="text-black/35 hover:text-black/60 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="Paste a job URL or the full description text…"
              rows={4}
              className="w-full resize-none rounded-xl border border-black/12 bg-white px-3.5 py-3 text-sm text-primary placeholder:text-black/35 focus:outline-none focus:border-primary/40"
            />
            <div className="flex items-center justify-between gap-4 mt-3">
              <p className="text-xs text-black/40">
                We&apos;ll keep chatting about {JD_CONTENT.company} · {JD_CONTENT.role} until you swap it in.
              </p>
              <div className="flex-none flex gap-2">
                <StickerButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPasteOpen(false);
                    setPasteValue("");
                  }}>
                  Cancel
                </StickerButton>
                <StickerButton variant="primary" size="sm" onClick={() => setPasteOpen(false)}>
                  Use this job
                </StickerButton>
              </div>
            </div>
          </DashCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5 items-start">
          {/* Left: pasted job card */}
          <DashCard className="p-6 lg:sticky lg:top-24">
            <Pill variant="neutral" className="mb-4">
              Pasted job
            </Pill>
            <p className="text-lg font-bold text-primary leading-snug">{JD_CONTENT.role}</p>
            <p className="text-sm text-black/50 font-medium mb-4">{JD_CONTENT.company}</p>
            <Pill variant="positive" className="mb-5">
              {JD_CONTENT.salary}
            </Pill>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2">
              Full description
            </p>
            <p className="text-sm text-black/70 leading-relaxed">
              {renderHighlightedJd(JD_CONTENT.jdText, JD_CONTENT.highlight)}
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
      </main>
    </div>
  );
};

export default JdqaClient;
