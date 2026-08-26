"use client";

import { FC, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Copy, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { buildDemoReport } from "@/app/lib/dashboard/prep-engine";
import { formatsLabel } from "@/app/lib/dashboard/prep-data";
import type { DimensionScore, LanguageStat, PrepSession, PrepTrack } from "@/app/lib/dashboard/prep-data";
import PreviewToggle from "./PreviewToggle";
import EvidenceDialog from "./EvidenceDialog";

export interface PrepReportProps {
  track: PrepTrack;
  session: PrepSession;
  onBack: () => void;
  onRunAnother: () => void;
  onToggleAction: (actionId: string) => void;
}

const GENERATING_STEPS = ["Read the transcript", "Scored six dimensions", "Writing rewrites and actions…"];

const PrepReport: FC<PrepReportProps> = ({ track, session: sessionProp, onBack, onRunAnother, onToggleAction }) => {
  const [ready, setReady] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [preview, setPreview] = useState<"default" | "too-short">("default");
  // A real session that was skipped through has nothing to show, so the
  // "Default" preview would render the too-short state and the full report
  // would be unreachable. Substituting a demo report — scored by the real
  // engine over a canned transcript — makes both states actually viewable.
  // Built lazily so the substitution costs nothing on a normal report.
  const [demo] = useState(() => buildDemoReport(track));
  const session: PrepSession =
    preview === "too-short" ? { ...sessionProp, tooShort: true } : sessionProp.tooShort ? demo : sessionProp;
  const showingDemo = preview === "default" && sessionProp.tooShort;

  // Demo action ids don't exist on the track, so they'd be inert if routed
  // through onToggleAction. Ticking them locally keeps the preview honest
  // about how the checklist behaves without writing sample data to the track.
  const [demoDone, setDemoDone] = useState<Record<string, boolean>>({});
  // Which score or stat is opened up, if any.
  const [openDetail, setOpenDetail] = useState<DimensionScore | LanguageStat | null>(null);
  const detailIsStat = openDetail !== null && "value" in openDetail;

  function isActionDone(a: { id: string; done: boolean }): boolean {
    if (showingDemo) return demoDone[a.id] ?? false;
    return track.actions.find((ta) => ta.id === a.id)?.done ?? a.done;
  }

  function toggleAction(actionId: string) {
    if (showingDemo) setDemoDone((prev) => ({ ...prev, [actionId]: !prev[actionId] }));
    else onToggleAction(actionId);
  }

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1400);
    return () => clearTimeout(t);
  }, []);

  const priorSessions = track.sessions.filter((s) => s.completedAt < session.completedAt);
  const prior = priorSessions[priorSessions.length - 1];
  const delta = prior && !prior.tooShort && !session.tooShort ? session.overallScore - prior.overallScore : null;

  return (
    <div className="max-w-[1000px] mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          {track.company} — {track.role}
        </button>
        <PreviewToggle
          value={preview}
          onChange={setPreview}
          options={[
            { id: "default", label: "Default" },
            { id: "too-short", label: "Too short" },
          ]}
        />
      </div>

      <DashCard className="p-6 flex items-center gap-6 flex-wrap">
        <div className="flex-none flex items-end gap-2.5">
          <span className="text-4xl font-bold text-primary leading-none tabular-nums">{session.tooShort ? "—" : session.overallScore}</span>
          {delta !== null && (
            <span className={cn("text-sm font-bold pb-1", delta >= 0 ? "text-[#55591f]" : "text-black/45")}>
              {delta >= 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-[220px]">
          <p className="text-[15px] font-bold text-primary mb-1">
            {formatsLabel(session.formats)} · {session.lengthMinutes} min
          </p>
          <p className="text-xs text-black/50">
            {session.difficulty} · {track.company}
          </p>
        </div>
        <div className="flex gap-2.5 flex-none flex-wrap">
          <button
            type="button"
            onClick={onRunAnother}
            className="text-xs font-bold bg-[#222325] text-white rounded-lg px-3.5 py-2.5 cursor-pointer transition-[transform,box-shadow] duration-100 hover:shadow-[3px_3px_0_0_#e1f073] hover:-translate-x-px hover:-translate-y-px inline-flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5" />
            Run another session
          </button>
          <button type="button" onClick={onBack} className="text-xs font-semibold border-[1.5px] border-black/16 rounded-lg px-3.5 py-2.5 cursor-pointer hover:border-black/40">
            Back to prep
          </button>
        </div>
      </DashCard>

      {!ready && (
        <DashCard className="p-6">
          <p className="text-sm font-bold text-primary mb-3.5">Writing your report</p>
          <div className="flex flex-col gap-2.5">
            {GENERATING_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2.5 text-sm font-semibold text-primary">
                <span
                  className={cn(
                    "h-4.5 w-4.5 rounded-full flex items-center justify-center text-[9px] flex-none",
                    i < 2 ? "bg-secondary" : "border-2 border-[#222325]"
                  )}>
                  {i < 2 ? "✓" : ""}
                </span>
                {s}
              </div>
            ))}
          </div>
          <ProgressBar value={68} className="mt-4" height="h-1.5" />
        </DashCard>
      )}

      {ready && session.tooShort && (
        <DashCard className="p-7 border-dashed border-2 border-black/20">
          <p className="text-[15px] font-bold text-primary mb-1.5">Too short to score</p>
          <p className="text-sm text-black/60 leading-relaxed max-w-[460px] mb-4">
            You answered {session.transcript.filter((t) => t.who === "user" && t.text.trim()).length} question
            {session.transcript.filter((t) => t.who === "user" && t.text.trim()).length === 1 ? "" : "s"} — scoring needs a bit more to be
            worth anything. The transcript is below and kept either way.
          </p>
          <button type="button" onClick={onRunAnother} className="text-xs font-bold bg-[#222325] text-white rounded-lg px-3.5 py-2.5 cursor-pointer w-fit">
            Run a proper session
          </button>
        </DashCard>
      )}

      {ready && !session.tooShort && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <DashCard className="p-6">
              <p className="text-[14.5px] font-bold text-primary mb-4">Scorecard</p>
              <div className="flex flex-col gap-3.5">
                {session.dimensions.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setOpenDetail(d)}
                    className="group text-left w-full cursor-pointer rounded-lg -mx-2 px-2 py-1.5 hover:bg-[#fbfbf7] transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-primary inline-flex items-center gap-1">
                        {d.label}
                        <ChevronRight className="h-3.5 w-3.5 text-black/25 group-hover:text-black/60 transition-colors" />
                      </span>
                      <span className="text-sm font-bold text-primary tabular-nums">{d.score}</span>
                    </div>
                    <ProgressBar value={d.score * 10} fillColor={d.score < 7 ? "#cddd54" : "#e1f073"} height="h-1.5" className="mb-1.5" />
                    <p className="text-xs text-black/50 leading-relaxed">{d.note}</p>
                  </button>
                ))}
              </div>
            </DashCard>

            <div className="flex flex-col gap-5">
              <div className="bg-[#222325] text-white rounded-2xl p-5">
                <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-secondary mb-2.5">Coach note</p>
                <p className="text-sm text-white/80 leading-relaxed">{session.coachNote}</p>
              </div>
              <DashCard className="p-5">
                <p className="text-[14.5px] font-bold text-primary mb-3.5">How you spoke</p>
                <div className="flex flex-col gap-2.5">
                  {session.languageStats.map((stat) => (
                    <button
                      key={stat.id}
                      type="button"
                      onClick={() => setOpenDetail(stat)}
                      className="group flex items-baseline justify-between gap-3 w-full text-left cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-[#fbfbf7] transition-colors">
                      <span className="text-sm text-black/60 inline-flex items-center gap-1">
                        {stat.label}
                        <ChevronRight className="h-3.5 w-3.5 text-black/25 group-hover:text-black/60 transition-colors" />
                      </span>
                      <span className={cn("text-sm font-semibold text-right", stat.good ? "text-primary" : "text-black/45")}>{stat.value}</span>
                    </button>
                  ))}
                </div>
              </DashCard>
            </div>
          </div>

          {session.rewrites.length > 0 && (
            <DashCard className="p-0 overflow-hidden">
              <p className="text-[14.5px] font-bold text-primary px-6 py-4 border-b border-black/8">
                {session.rewrites.length === 1 ? "One answer worth revisiting" : `${session.rewrites.length} answers worth revisiting`}
              </p>
              {session.rewrites.map((r) => (
                <div key={r.id} className="px-6 py-5 border-b border-black/6 last:border-b-0">
                  <p className="text-sm font-bold text-primary mb-3">{r.question}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="rounded-xl border border-black/8 bg-[#fbfbf7] p-3.5">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-black/40 mb-2">What you typed</p>
                      <p className="text-sm text-black/65 leading-relaxed">{r.said}</p>
                    </div>
                    <div className="rounded-xl border-2 border-[#222325] p-3.5 shadow-[3px_3px_0_0_#e1f073]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-primary">A stronger version</p>
                        <button type="button" onClick={() => navigator.clipboard?.writeText(r.better)} className="text-black/40 hover:text-primary cursor-pointer">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-primary leading-relaxed">{r.better}</p>
                    </div>
                  </div>
                  <p className="text-xs text-black/45 mt-2.5">{r.why}</p>
                </div>
              ))}
            </DashCard>
          )}

          <DashCard className="p-6">
            <div className="flex items-baseline justify-between mb-3.5">
              <p className="text-[14.5px] font-bold text-primary">Do these before your next round</p>
              <span className="text-xs text-black/45 tabular-nums">
                {session.actionItems.filter(isActionDone).length} of {session.actionItems.length} done
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {session.actionItems.map((a) => {
                const done = isActionDone(a);
                return (
                  <button key={a.id} type="button" className="group flex gap-3 items-start text-left cursor-pointer" onClick={() => toggleAction(a.id)}>
                    <NeoCheckbox checked={done} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm font-semibold", done ? "text-black/40 line-through" : "text-primary")}>{a.title}</span>
                      <span className="block text-xs text-black/45 mt-0.5">{a.detail}</span>
                    </span>
                    <span className="text-xs font-bold text-black/45 flex-none tabular-nums">{a.effortMinutes} min</span>
                  </button>
                );
              })}
            </div>
          </DashCard>
        </>
      )}

      <button
        type="button"
        onClick={() => setTranscriptOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-6 py-4 cursor-pointer hover:border-black/25 transition-colors">
        <span className="text-sm font-bold text-primary">Full transcript · {session.transcript.filter((t) => t.who === "ai").length} questions</span>
        <span className="text-xs font-bold text-black/50 inline-flex items-center gap-1">
          {transcriptOpen ? "Hide" : "Show"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", transcriptOpen && "rotate-180")} />
        </span>
      </button>

      {openDetail && (
        <EvidenceDialog
          open
          onOpenChange={(v) => !v && setOpenDetail(null)}
          title={openDetail.label}
          value={detailIsStat ? (openDetail as LanguageStat).value : `${(openDetail as DimensionScore).score} / 10`}
          summary={detailIsStat ? "" : (openDetail as DimensionScore).note}
          howToImprove={openDetail.howToImprove}
          evidence={openDetail.evidence}
        />
      )}

      {transcriptOpen && (
        <DashCard className="p-6 flex flex-col gap-3.5">
          {session.transcript.map((t) => (
            <div key={t.id}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-black/35 mb-1">{t.who === "user" ? "You" : "Interviewer"}</p>
              <p className={cn("text-sm leading-relaxed", t.who === "user" ? "text-primary" : "text-black/60")}>{t.text}</p>
            </div>
          ))}
        </DashCard>
      )}
    </div>
  );
};

export default PrepReport;
