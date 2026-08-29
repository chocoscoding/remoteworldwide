"use client";

import { FC, useState } from "react";
import { ArrowLeft, DollarSign, Info, MessageCircle, Presentation } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import { FORMAT_META, QUESTIONS_FOR_LENGTH, SESSION_LENGTHS, formatsLabel, type Difficulty, type PrepTrack, type SessionFormat, type SessionLength } from "@/app/lib/dashboard/prep-data";
import PreviewToggle from "./PreviewToggle";

const FORMAT_ICON: Record<SessionFormat, LucideIcon> = { behavioural: MessageCircle, portfolio: Presentation, salary: DollarSign };

const DIFFICULTIES: { id: Difficulty; label: string; note: string }[] = [
  { id: "warm-up", label: "Warm-up", note: "Friendly pacing, no follow-up pressure — good for a first pass at a new format." },
  { id: "standard", label: "Standard", note: "Matches a typical first or second round." },
  { id: "tough", label: "Tough", note: "Pushier follow-ups and pointed pressure — closer to a final round or a panel that likes to dig." },
];

export const MAX_SESSIONS_PER_TRACK = 6;

export interface SessionConfig {
  /** One or more formats — a session can drill several in one run. */
  formats: SessionFormat[];
  difficulty: Difficulty;
  lengthMinutes: SessionLength;
}

export interface PrepSetupProps {
  track: PrepTrack;
  initialFormats?: SessionFormat[];
  onBack: () => void;
  onStart: (config: SessionConfig) => void;
}

const PrepSetup: FC<PrepSetupProps> = ({ track, initialFormats, onBack, onStart }) => {
  const [formats, setFormats] = useState<SessionFormat[]>(initialFormats?.length ? initialFormats : ["behavioural"]);

  // Never let the last one be unticked — a session with no format has no
  // questions to ask, so the control refuses rather than erroring later.
  function toggleFormat(f: SessionFormat) {
    setFormats((prev) => (prev.includes(f) ? (prev.length === 1 ? prev : prev.filter((x) => x !== f)) : [...prev, f]));
  }
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [lengthMinutes, setLengthMinutes] = useState<SessionLength>(15);
  const [preview, setPreview] = useState<"default" | "blocked">("default");

  const blocked = preview === "blocked" || track.sessions.length >= MAX_SESSIONS_PER_TRACK;
  const difficultyNote = DIFFICULTIES.find((d) => d.id === difficulty)?.note ?? "";

  return (
    <div className="max-w-[720px] mx-auto flex flex-col gap-5">
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
            { id: "blocked", label: "Blocked" },
          ]}
        />
      </div>

      <div>
        <p className="text-2xl font-bold text-primary mb-1.5">Set up the session</p>
        <p className="text-sm text-black/55">
          {track.company} · {track.role} · {track.roundLabel}
        </p>
      </div>

      <DashCard className="p-6">
        <p className="text-[14.5px] font-bold text-primary mb-3.5">Format</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(Object.keys(FORMAT_META) as SessionFormat[]).map((f) => {
            const Icon = FORMAT_ICON[f];
            const selected = formats.includes(f);
            const isLast = selected && formats.length === 1;
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFormat(f)}
                aria-pressed={selected}
                title={isLast ? "A session needs at least one format" : undefined}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3.5 text-left transition-colors cursor-pointer",
                  selected ? "border-primary bg-[#fbfbf7]" : "border-black/10 hover:border-black/25",
                  isLast && "cursor-default"
                )}>
                <span className="mt-0.5 group">
                  <NeoCheckbox checked={selected} size="sm" interactive={!isLast} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-black/45 flex-none" />
                    <span className="text-sm font-bold text-primary">{FORMAT_META[f].label}</span>
                  </span>
                  <span className="block text-xs text-black/45 mt-1">{FORMAT_META[f].sub}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-black/45 mt-3">
          Pick as many as you want — questions alternate between them.
        </p>
      </DashCard>

      <DashCard className="p-6">
        <p className="text-[14.5px] font-bold text-primary mb-3.5">Difficulty</p>
        <div className="flex gap-2 flex-wrap">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficulty(d.id)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer transition-colors border-[1.5px]",
                difficulty === d.id ? "bg-[#222325] text-white border-[#222325]" : "border-black/14 text-black/60 hover:border-black/30"
              )}>
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-black/50 leading-relaxed mt-3">{difficultyNote}</p>
      </DashCard>

      <DashCard className="p-6">
        <div className="flex items-baseline justify-between mb-3.5">
          <p className="text-[14.5px] font-bold text-primary">Length</p>
          <span className="text-xs text-black/50">{QUESTIONS_FOR_LENGTH[lengthMinutes]} questions</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {SESSION_LENGTHS.map((len) => (
            <button
              key={len}
              type="button"
              onClick={() => setLengthMinutes(len)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer transition-colors border-[1.5px]",
                lengthMinutes === len ? "bg-[#222325] text-white border-[#222325]" : "border-black/14 text-black/60 hover:border-black/30"
              )}>
              {len} min
            </button>
          ))}
        </div>
      </DashCard>

      <DashCard className="p-5 flex gap-3 items-start bg-[#fbfbf7]">
        <Info className="h-4 w-4 text-black/40 flex-none mt-0.5" />
        <p className="text-xs text-black/60 leading-relaxed">
          Answer by typing, or press <b className="font-bold text-primary">Dictate</b> to speak — your browser transcribes it on the
          spot and only the text is kept. No audio is recorded or uploaded, and nothing leaves this screen.
        </p>
      </DashCard>

      <div className="bg-[#222325] text-white rounded-2xl p-6 flex items-center gap-5 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <p className="text-[14.5px] font-bold mb-1">
            {blocked ? "Session limit reached for this track" : `${formatsLabel(formats)} · ${difficulty} · ${lengthMinutes} min`}
          </p>
          <p className="text-xs text-white/60 leading-relaxed">
            {blocked
              ? `You've run ${MAX_SESSIONS_PER_TRACK} sessions for ${track.company}. Try a different track, or come back after acting on your open actions.`
              : `${QUESTIONS_FOR_LENGTH[lengthMinutes]} questions, typed answers, a scorecard at the end.`}
          </p>
        </div>
        {blocked ? (
          <span className="text-sm font-bold bg-white/10 text-white/40 rounded-lg px-5 py-3 flex-none whitespace-nowrap">Start session</span>
        ) : (
          <button
            type="button"
            onClick={() => onStart({ formats, difficulty, lengthMinutes })}
            className="text-sm font-bold bg-secondary text-primary rounded-lg px-5 py-3 flex-none whitespace-nowrap cursor-pointer transition-shadow hover:shadow-[3px_3px_0_0_rgba(255,255,255,.25)]">
            Start session
          </button>
        )}
      </div>
    </div>
  );
};

export default PrepSetup;
