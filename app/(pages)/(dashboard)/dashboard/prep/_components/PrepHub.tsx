"use client";

import { FC, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Info, ListChecks, Mic, Sparkles, Users } from "lucide-react";
import { format as formatDate } from "date-fns";
import { cn } from "@/lib/utils";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import { computePreparedness } from "@/app/lib/dashboard/prep-engine";
import { formatsLabel } from "@/app/lib/dashboard/prep-data";
import type { PrepTrack, ReadinessStatus, RoundOutcome, SessionFormat } from "@/app/lib/dashboard/prep-data";
import type { ChipTone } from "./Chip";
import Chip from "./Chip";
import PrepEmptyState from "./PrepEmptyState";
import PreviewToggle from "./PreviewToggle";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import { roundDateLabel, trackState } from "./track-state";
import { BUTTON_ACCENT, BUTTON_OUTLINE, BUTTON_SOLID, ICON_BUTTON_PRESS, PANEL, RAISED_DARK } from "./prep-styles";

type Tab = "overview" | "panel" | "questions" | "sessions" | "actions";

/** Readiness maps onto the same semantic tones as everything else: green
 *  means done, red means it needs work, white means untouched. */
const READINESS: Record<ReadinessStatus, { label: string; tone: ChipTone }> = {
  ready: { label: "Ready", tone: "green" },
  "needs-work": { label: "Needs work", tone: "red" },
  new: { label: "Not practised", tone: "white" },
};

export interface PrepHubProps {
  track: PrepTrack;
  now: Date;
  onBack: () => void;
  onStartSession: (formats?: SessionFormat[]) => void;
  onViewReport: (sessionId: string) => void;
  onToggleAction: (actionId: string) => void;
  onResearchPanel: () => void;
  onSetOutcome: (outcome: RoundOutcome) => void;
}

const PrepHub: FC<PrepHubProps> = ({ track: trackProp, now, onBack, onStartSession, onViewReport, onToggleAction, onResearchPanel, onSetOutcome }) => {
  const [tab, setTab] = useState<Tab>("overview");
  const [researching, setResearching] = useState(false);
  const [preview, setPreview] = useState<"default" | "empty">("default");
  // Preview override clears panel/questions/sessions/actions for display only
  // — it never touches the real track, so toggling back to Default always
  // shows the real, current data untouched.
  const track = preview === "empty" ? { ...trackProp, panel: [], questions: [], sessions: [], actions: [] } : trackProp;

  const score = computePreparedness(track);
  const doneActions = track.actions.filter((a) => a.done).length;
  const roundPassed = Boolean(track.roundDate && new Date(track.roundDate) < now);
  const showOutcomeBanner = roundPassed && track.outcome === null;
  const lastSession = track.sessions[track.sessions.length - 1];

  const state = trackState(track, now);
  const dateLabel = roundDateLabel(track);

  function handleResearch() {
    setResearching(true);
    // Simulated latency, same convention as parse-jd.ts's parseJobUrl delay —
    // the mutation itself (populating track.panel) is owned by the provider.
    setTimeout(() => {
      setResearching(false);
      onResearchPanel();
    }, 700);
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "panel", label: "Panel", count: track.panel.length },
    { id: "questions", label: "Questions", count: track.questions.length },
    { id: "sessions", label: "Sessions", count: track.sessions.length },
    { id: "actions", label: "Actions", count: track.actions.length },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          All interviews
        </button>
        <PreviewToggle
          value={preview}
          onChange={setPreview}
          options={[
            { id: "default", label: "Default" },
            { id: "empty", label: "Empty" },
          ]}
        />
      </div>

      {/* The one raised surface on this screen: who you're prepping for, how
          ready you are, and the single action that changes that. Identity on
          one line, state as chips, score as a plain number — a ring reading
          "0" in 8px type was the least legible part of this page. */}
      <div className={cn(RAISED_DARK, "px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-4")}>
        <span className="h-11 w-11 flex-none rounded-xl bg-white/10 flex items-center justify-center text-sm font-extrabold text-[#e1f073]">
          {track.companyMark}
        </span>

        <div className="flex-1 min-w-[240px]">
          <h2 className="text-[19px] font-bold leading-tight">
            {track.company} — {track.role}
          </h2>
          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            {/* THREE STATE-CHIP OPTIONS, SIDE BY SIDE FOR COMPARISON.
                Keep one and delete the other two (plus the unused palettes in
                Chip.tsx) once picked. */}
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/25">1</span>
              <Chip tone={state.tone} onDark darkVariant="solid">
                {state.label}
              </Chip>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/25">2</span>
              <Chip tone={state.tone} onDark darkVariant="a">
                {state.label}
              </Chip>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/25">3</span>
              <Chip tone={state.tone} onDark darkVariant="b">
                {state.label}
              </Chip>
            </span>

            <span className="text-xs text-white/45">
              {track.roundLabel}
              {dateLabel ? ` · ${dateLabel}` : ""} · {track.location}
            </span>
          </div>
        </div>

        <div className="flex-none flex items-center gap-6">
          <ScoreRing
            value={score}
            size={78}
            tone="dark"
            label={
              <span className="text-center leading-none">
                <span className="block text-[19px] font-bold tabular-nums">
                  {score}
                  <span className="text-[12px]">%</span>
                </span>
                <span className="block text-[8.5px] font-bold uppercase tracking-[0.09em] text-white/40 mt-1">Prepared</span>
              </span>
            }
          />
          <button type="button" onClick={() => onStartSession()} className={BUTTON_ACCENT}>
            <Mic className="h-3.5 w-3.5" />
            Start a session
          </button>
        </div>
      </div>

      {showOutcomeBanner && (
        <div className={cn(PANEL, "p-4 flex items-center gap-4 flex-wrap")}>
          <span className="text-sm font-bold text-primary flex-1 min-w-[200px]">This round has passed. How did it go?</span>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => onSetOutcome("offer")} className={BUTTON_ACCENT}>
              Got an offer
            </button>
            <button type="button" onClick={() => onSetOutcome("rejected")} className={BUTTON_OUTLINE}>
              Didn&apos;t move forward
            </button>
            <button type="button" onClick={() => onSetOutcome("waiting")} className={BUTTON_OUTLINE}>
              Still waiting
            </button>
          </div>
        </div>
      )}

      <SlidingTabs value={tab} options={TABS} onChange={setTab} />

      {tab === "overview" && (
        <div className="flex flex-wrap gap-5 items-start">
          <div className="flex-1 min-w-0 basis-[560px] flex flex-col gap-5">
            <div className={cn(PANEL, "overflow-hidden")}>
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-black/10">
                <span className="text-sm font-bold text-primary">Questions they&apos;re likely to ask</span>
                {track.questions.length > 3 && (
                  <button type="button" onClick={() => setTab("questions")} className="text-xs font-bold text-black/50 hover:text-primary cursor-pointer whitespace-nowrap">
                    See all {track.questions.length} →
                  </button>
                )}
              </div>
              {track.questions.length === 0 ? (
                <PrepEmptyState bare icon={Sparkles} title="No questions yet" body="Run a session or research the panel to build this out." />
              ) : (
                track.questions.slice(0, 3).map((q) => (
                  <div key={q.id} className="flex items-center gap-3.5 px-5 py-3.5 border-b border-black/10 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-primary mb-0.5">{q.text}</p>
                      <p className="text-xs text-black/45">{q.sub}</p>
                    </div>
                    <Chip tone={READINESS[q.status].tone}>{READINESS[q.status].label}</Chip>
                  </div>
                ))
              )}
            </div>

            <div className={cn(PANEL, "p-5")}>
              <p className="text-sm font-bold text-primary mb-4">What to expect in this round</p>
              {track.panel.length === 0 ? (
                <PrepEmptyState
                  bare
                  icon={Users}
                  title="No panel research yet"
                  body="This gets written from who's actually in the room — about a minute to build."
                  ctaLabel="Research the panel"
                  onCta={handleResearch}
                  ctaBusy={researching}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-4">
                    {track.panel.slice(0, 2).map((p) => (
                      <div key={p.id} className="flex gap-3">
                        <span className="h-8 w-8 flex-none rounded-full bg-[#f0f0ea] flex items-center justify-center text-[10.5px] font-extrabold text-black/60">
                          {p.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <p className="text-sm text-black/65 leading-relaxed">
                          <b className="text-primary">
                            {p.name}, {p.role}
                          </b>{" "}
                          — {p.note}
                        </p>
                      </div>
                    ))}
                  </div>
                  {track.panel.some((p) => p.inferred) && (
                    <p className="text-xs text-black/40 border-t border-black/10 mt-4 pt-3">Inferred from public sources. It can be wrong.</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 basis-[300px] flex flex-col gap-5">
            <div className={cn(PANEL, "p-5")}>
              <div className="flex items-baseline justify-between gap-3 mb-3.5">
                <p className="text-sm font-bold text-primary">Next actions</p>
                <span className="text-xs text-black/45 tabular-nums">
                  {doneActions}/{track.actions.length}
                </span>
              </div>
              {track.actions.length === 0 ? (
                <p className="text-xs text-black/45 leading-relaxed">Nothing queued yet — run a session to generate a checklist.</p>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    {track.actions
                      .filter((a) => !a.done)
                      .slice(0, 3)
                      .map((a) => (
                        <button key={a.id} type="button" className="group flex gap-2.5 items-start text-left cursor-pointer" onClick={() => onToggleAction(a.id)}>
                          <NeoCheckbox checked={a.done} size="sm" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-primary">{a.title}</span>
                            <span className="block text-xs text-black/45">{a.source}</span>
                          </span>
                        </button>
                      ))}
                  </div>
                  <button type="button" onClick={() => setTab("actions")} className="text-xs font-bold text-black/50 hover:text-primary cursor-pointer mt-4">
                    See all actions →
                  </button>
                </>
              )}
            </div>

            {track.sessions.length === 0 ? (
              <div className={cn(PANEL, "p-5")}>
                <p className="text-sm font-bold text-primary mb-1">No sessions yet</p>
                <p className="text-sm text-black/50 leading-relaxed mb-4">Your score stays at 0 until you run one. Six minutes gives you a scorecard and a first checklist.</p>
                <button type="button" onClick={() => onStartSession()} className={BUTTON_SOLID}>
                  Run the first session
                </button>
              </div>
            ) : (
              <div className={cn(PANEL, "p-5")}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <p className="text-sm font-bold text-primary">Last session</p>
                  <span className="text-xs text-black/45">{formatsLabel(lastSession.formats)}</span>
                </div>
                <p className="text-xs text-black/45 mb-4">
                  {formatDate(new Date(lastSession.completedAt), "EEE d MMM")} · {lastSession.tooShort ? "not scored" : `${lastSession.overallScore}/100`}
                </p>
                <button type="button" onClick={() => onViewReport(lastSession.id)} className={BUTTON_OUTLINE}>
                  View full report
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "panel" && (
        <div className={cn(PANEL, "p-5")}>
          {track.panel.length === 0 ? (
            <PrepEmptyState
              bare
              icon={Users}
              title="No panel research yet"
              body="This gets written from who's actually in the room — about a minute to build."
              ctaLabel="Research the panel"
              onCta={handleResearch}
              ctaBusy={researching}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {track.panel.map((p) => (
                <div key={p.id} className="flex gap-3.5 border-b border-black/10 pb-4 last:border-b-0 last:pb-0">
                  <span className="h-10 w-10 flex-none rounded-full bg-[#f0f0ea] flex items-center justify-center text-[11px] font-extrabold text-black/60">
                    {p.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary">
                      {p.name} <span className="font-medium text-black/45">· {p.role}</span>
                    </p>
                    <p className="text-sm text-black/60 leading-relaxed mt-1">{p.note}</p>
                    {p.inferred && (
                      <p className="text-xs text-black/40 mt-1.5 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Inferred from public sources. It can be wrong.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "questions" && (
        <div className={cn(PANEL, "overflow-hidden")}>
          {track.questions.length === 0 ? (
            <PrepEmptyState bare icon={Sparkles} title="No questions yet" body="Run a session or research the panel to build this out." />
          ) : (
            track.questions.map((q) => (
              <div key={q.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-black/10 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-primary">{q.text}</p>
                  <p className="text-xs text-black/45 mt-0.5">{q.sub}</p>
                </div>
                <Chip tone={READINESS[q.status].tone}>{READINESS[q.status].label}</Chip>
                <button type="button" onClick={() => onStartSession([q.format])} className={cn(BUTTON_OUTLINE, "flex-none")}>
                  Practise
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "sessions" && (
        <div className={cn(PANEL, "overflow-hidden")}>
          {track.sessions.length === 0 ? (
            <PrepEmptyState bare icon={Mic} title="No sessions yet" body="Run a mock interview to start building history here." ctaLabel="Start a session" onCta={() => onStartSession()} />
          ) : (
            [...track.sessions].reverse().map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-black/10 last:border-b-0 hover:bg-[#fbfbf7] transition-colors">
                <button type="button" onClick={() => onViewReport(s.id)} className="min-w-0 flex-1 text-left cursor-pointer">
                  <span className="block text-sm font-bold text-primary">{formatsLabel(s.formats)}</span>
                  <span className="block text-xs text-black/45">
                    {formatDate(new Date(s.completedAt), "EEE d MMM")} · {s.lengthMinutes} min
                  </span>
                </button>
                <ScoreRing
                  value={s.tooShort ? 0 : s.overallScore}
                  size={34}
                  label={<span className="text-[10.5px] font-bold text-primary tabular-nums">{s.tooShort ? "—" : s.overallScore}</span>}
                />
                <button type="button" onClick={() => onViewReport(s.id)} aria-label="View this session's report" className={ICON_BUTTON_PRESS}>
                  <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "actions" && (
        <div className={cn(PANEL, "p-5")}>
          {track.actions.length === 0 ? (
            <PrepEmptyState bare icon={ListChecks} title="Nothing queued yet" body="Actions show up once you run a session or research the panel." />
          ) : (
            <div className="flex flex-col gap-4">
              {track.actions.map((a) => (
                <button key={a.id} type="button" className="group flex gap-3 items-start text-left cursor-pointer" onClick={() => onToggleAction(a.id)}>
                  <NeoCheckbox checked={a.done} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", a.done ? "text-black/40 line-through" : "text-primary")}>{a.title}</span>
                    <span className="block text-xs text-black/45 mt-0.5">{a.detail}</span>
                    <span className="block text-[11px] text-black/35 mt-1">{a.source}</span>
                  </span>
                  <span className="flex-none text-[11px] font-bold text-black/45 tabular-nums">{a.effortMinutes} min</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {track.status === "closed" && (
        <p className="text-xs text-black/40 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          This track is closed{track.outcome === "rejected" ? " — didn't move forward." : "."}
        </p>
      )}
    </div>
  );
};

export default PrepHub;
