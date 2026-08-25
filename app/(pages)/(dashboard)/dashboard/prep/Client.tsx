"use client";

import { FC, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  DollarSign,
  MessageCircle,
  Mic,
  Presentation,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";

// ---------------------------------------------------------------------------
// Local content — this screen's mock data isn't shared with any other
// screen, so it's kept here rather than in mock-data.ts.
// ---------------------------------------------------------------------------

type ReadinessStatus = "ready" | "needs-work" | "new";

interface PrepQuestion {
  id: string;
  q: string;
  status: ReadinessStatus;
}

const INITIAL_QUESTIONS: PrepQuestion[] = [
  {
    id: "q-owned-outcome",
    q: "Walk me through a project where you owned the outcome end-to-end.",
    status: "ready",
  },
  {
    id: "q-dx-preview",
    q: "How would you improve the developer experience of our deploy previews?",
    status: "new",
  },
  {
    id: "q-pushback",
    q: "Tell us about a time you pushed back on an engineering constraint.",
    status: "needs-work",
  },
];

const READINESS_META: Record<ReadinessStatus, { label: string; variant: NonNullable<PillProps["variant"]> }> = {
  ready: { label: "Answer ready", variant: "positive" },
  "needs-work": { label: "Needs work", variant: "neutral" },
  new: { label: "New", variant: "outline-dashed" },
};

interface PanelMember {
  id: string;
  name: string;
  role: string;
  note: string;
}

const PANEL: PanelMember[] = [
  {
    id: "panel-priya",
    name: "Priya Chen",
    role: "Design Lead",
    note: "Pushes on systems thinking — expect a follow-up on how you'd scale a pattern across teams.",
  },
  {
    id: "panel-jonas",
    name: "Jonas Kessler",
    role: "Staff Engineer",
    note: "Wants to hear you reason about technical constraints out loud, not just present a finished decision.",
  },
];

interface MockMetric {
  id: string;
  label: string;
  score: number;
}

const LAST_MOCK_METRICS: MockMetric[] = [
  { id: "structure", label: "Structure", score: 8 },
  { id: "specifics", label: "Specifics & numbers", score: 6 },
  { id: "pace", label: "Pace", score: 9 },
];

interface PracticeFormat {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const PRACTICE_FORMATS: PracticeFormat[] = [
  {
    id: "behavioural",
    label: "Behavioural",
    description: "STAR-format questions about past decisions.",
    icon: MessageCircle,
  },
  {
    id: "portfolio",
    label: "Portfolio walkthrough",
    description: "Narrate a project end-to-end, on the clock.",
    icon: Presentation,
  },
  {
    id: "salary",
    label: "Salary conversation",
    description: "Practise anchoring and handling pushback.",
    icon: DollarSign,
  },
];

const PrepClient: FC = () => {
  const [questions, setQuestions] = useState<PrepQuestion[]>(INITIAL_QUESTIONS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>("behavioural");
  const [mockActive, setMockActive] = useState(false);
  const [mockLabel, setMockLabel] = useState("6-minute drill");

  const markReady = (id: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, status: "ready" } : q)));
  };

  const startMock = (label: string) => {
    setMockLabel(label);
    setMockActive(true);
  };

  const selectedFormatMeta = PRACTICE_FORMATS.find((f) => f.id === selectedFormat) ?? PRACTICE_FORMATS[0];

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Interview prep</h1>
        <StickerButton variant="primary" size="md" onClick={() => startMock("6-minute drill")}>
          <Mic className="h-4 w-4" />
          Start mock interview
        </StickerButton>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1180px] mx-auto">
        {/* Active mock-interview session banner */}
        {mockActive && (
          <DashCard className="mb-5 p-4 flex items-center gap-3 border-secondary bg-[#fbfbf7]">
            <span className="h-9 w-9 flex-none rounded-full bg-secondary text-primary flex items-center justify-center">
              <Clock className="h-4 w-4 animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-primary">Mock interview running — {mockLabel}</p>
              <p className="text-xs text-black/45">05:47 remaining · answers aren&apos;t recorded, this is just a timer</p>
            </div>
            <StickerButton variant="outline" size="sm" onClick={() => setMockActive(false)}>
              <X className="h-3.5 w-3.5" />
              End session
            </StickerButton>
          </DashCard>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
          {/* Left column */}
          <div className="flex flex-col gap-5 min-w-0">
            {/* Next up — dark card */}
            <div className="relative overflow-hidden rounded-[18px] bg-[#222325] text-white p-7">
              <div aria-hidden className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-secondary/25 blur-3xl pointer-events-none" />

              <div className="relative">
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-secondary mb-3">Next up</p>
                <h2 className="text-2xl font-bold mb-1.5">Vercel — Design craft round</h2>
                <p className="text-sm text-white/55 mb-5">Thu 14:00 GMT+1 · Round 2 of 4</p>

                <p className="text-sm text-white/70 leading-relaxed mb-6 max-w-[560px]">
                  You&apos;ll meet Priya Chen (Design Lead) and Jonas Kessler (Staff Engineer). Expect a portfolio
                  walkthrough followed by a live whiteboard problem on developer-tooling workflows.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <StickerButton variant="secondary" size="md" shadowColor="#ffffff" onClick={() => startMock("6-minute drill")}>
                    <Mic className="h-4 w-4" />
                    Run the 6-minute drill
                  </StickerButton>
                  <button
                    type="button"
                    onClick={() => setPanelOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-4 h-10 text-sm font-semibold text-white hover:border-white/40 hover:bg-white/5 transition-colors cursor-pointer">
                    <Users className="h-4 w-4" />
                    Research the panel
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", panelOpen && "rotate-180")} />
                  </button>
                </div>

                <div
                  className={cn(
                    "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                    panelOpen ? "max-h-[400px] opacity-100 mt-5" : "max-h-0 opacity-0"
                  )}>
                  <div className="flex flex-col gap-2.5 border-t border-white/10 pt-5">
                    {PANEL.map((p) => (
                      <div key={p.id} className="rounded-xl bg-white/5 p-3.5 flex gap-3">
                        <span className="h-8 w-8 flex-none rounded-full bg-white/10 text-secondary font-extrabold text-xs flex items-center justify-center">
                          {p.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">
                            {p.name} <span className="font-medium text-white/45">· {p.role}</span>
                          </p>
                          <p className="text-xs text-white/60 leading-relaxed mt-0.5">{p.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Questions they're likely to ask */}
            <DashCard className="p-6">
              <p className="text-[15px] font-bold text-primary mb-1">Questions they&apos;re likely to ask</p>
              <p className="text-xs text-black/45 mb-4">Pulled from your saved answers and the Vercel job description.</p>

              <div className="flex flex-col divide-y divide-black/8">
                {questions.map((item) => {
                  const meta = READINESS_META[item.status];
                  return (
                    <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                      <p className="text-sm text-primary flex-1 min-w-0">{item.q}</p>
                      <Pill variant={meta.variant} className="flex-none">
                        {meta.label}
                      </Pill>
                      {item.status === "ready" ? (
                        <span className="flex-none inline-flex items-center gap-1 text-xs font-semibold text-black/40">
                          <Check className="h-3.5 w-3.5" />
                          Practised
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markReady(item.id)}
                          className="flex-none inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
                          Practice this
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </DashCard>
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-5">
            {/* Last mock score card */}
            <DashCard className="p-6">
              <p className="text-[15px] font-bold text-primary mb-1">Last mock, Tuesday</p>
              <p className="text-xs text-black/45 mb-5">22 minutes · Behavioural format</p>

              <div className="flex flex-col gap-4 mb-5">
                {LAST_MOCK_METRICS.map((m) => (
                  <div key={m.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-black/60">{m.label}</span>
                      <span className="text-xs font-bold text-primary">{m.score}/10</span>
                    </div>
                    <ProgressBar value={m.score * 10} fillColor={m.score < 7 ? "#cddd54" : "#e1f073"} />
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-[#fbfbf7] border border-black/8 p-3.5">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-1.5">Coach note</p>
                <p className="text-sm text-black/70 leading-relaxed italic">
                  You lean on &ldquo;we&rdquo; a lot when describing decisions you made solo — swap 2-3 of those for
                  &ldquo;I&rdquo; in your STAR answers so the panel can tell what you actually owned.
                </p>
              </div>
            </DashCard>

            {/* Practise a format */}
            <DashCard className="p-6">
              <p className="text-[15px] font-bold text-primary mb-4">Practise a format</p>

              <div className="flex flex-col gap-2 mb-4">
                {PRACTICE_FORMATS.map((f) => {
                  const Icon = f.icon;
                  const selected = f.id === selectedFormat;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFormat(f.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer",
                        selected ? "border-primary bg-[#fbfbf7]" : "border-black/10 hover:border-black/25"
                      )}>
                      <span
                        className={cn(
                          "h-9 w-9 flex-none rounded-lg flex items-center justify-center",
                          selected ? "bg-primary text-secondary" : "bg-[#f0f0ea] text-primary"
                        )}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary">{f.label}</p>
                        <p className="text-xs text-black/45 truncate">{f.description}</p>
                      </div>
                      <span
                        className={cn(
                          "h-4 w-4 flex-none rounded-full border-2 flex items-center justify-center",
                          selected ? "border-primary" : "border-black/20"
                        )}>
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <StickerButton variant="primary" size="md" className="w-full" onClick={() => startMock(selectedFormatMeta.label)}>
                Start: {selectedFormatMeta.label}
              </StickerButton>
            </DashCard>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrepClient;
