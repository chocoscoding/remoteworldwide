"use client";

import { FC, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Mic, Plus, Search, Target } from "lucide-react";
import { differenceInCalendarDays, format as formatDate } from "date-fns";
import { cn } from "@/lib/utils";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import { computePreparedness } from "@/app/lib/dashboard/prep-engine";
import type { NewTrackInput, PrepTrack, SessionFormat } from "@/app/lib/dashboard/prep-data";
import Chip from "./Chip";
import PrepEmptyState from "./PrepEmptyState";
import PreviewToggle from "./PreviewToggle";
import AddTrackDialog from "./AddTrackDialog";
import { trackState } from "./track-state";
import { BUTTON_ACCENT, BUTTON_SOLID, FIELD_SHELL, ICON_BUTTON, ICON_BUTTON_PRESS, PANEL, RAISED_DARK } from "./prep-styles";

const EMPTY_TRACKS: PrepTrack[] = [];
const PAGE_SIZE = 5;

type Filter = "all" | "scheduled" | "needs-prep";

function heroDateLabel(track: PrepTrack, now: Date): string {
  if (!track.roundDate) return "Not scheduled";
  const days = differenceInCalendarDays(new Date(track.roundDate), now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatDate(new Date(track.roundDate), "EEE d MMM");
}

/** A handful of page numbers centred on the current one, capped to what exists. */
function pageWindow(current: number, total: number): number[] {
  const span = 5;
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export interface PrepIndexProps {
  tracks: PrepTrack[];
  now: Date;
  onOpenTrack: (trackId: string) => void;
  onQuickPractice: (trackId: string, formats?: SessionFormat[]) => void;
  onAddTrack: (input: NewTrackInput) => void;
}

const PrepIndex: FC<PrepIndexProps> = ({ tracks: tracksProp, now, onOpenTrack, onQuickPractice, onAddTrack }) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<"default" | "empty">("default");
  const [addOpen, setAddOpen] = useState(false);
  // Stable reference (not a fresh `[]` literal) so memoized derivations below
  // don't recompute every render while previewing the empty state.
  const tracks = preview === "empty" ? EMPTY_TRACKS : tracksProp;

  function setQueryAndResetPage(v: string) {
    setQuery(v);
    setPage(1);
  }

  function setFilterAndResetPage(v: Filter) {
    setFilter(v);
    setPage(1);
  }

  const heroTrack = useMemo(() => {
    const upcoming = tracks
      .filter((t) => t.status === "in-progress" && t.roundDate && new Date(t.roundDate) >= now)
      .sort((a, b) => new Date(a.roundDate!).getTime() - new Date(b.roundDate!).getTime());
    return upcoming[0] ?? null;
  }, [tracks, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter((t) => {
      if (q && !`${t.company} ${t.role}`.toLowerCase().includes(q)) return false;
      if (filter === "scheduled" && !(t.status === "in-progress" && t.roundDate)) return false;
      if (filter === "needs-prep" && !(t.status !== "closed" && computePreparedness(t) < 60)) return false;
      return true;
    });
  }, [tracks, query, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const active = tracks.filter((t) => t.status === "in-progress" || t.status === "awaiting-outcome");
  const aggregateScore = active.length === 0 ? 0 : Math.round(active.reduce((sum, t) => sum + computePreparedness(t), 0) / active.length);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setAddOpen(true)} className={BUTTON_SOLID}>
          <Plus className="h-3.5 w-3.5" />
          Prep for a new job
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

      {/* Top band: what's next, and where you stand. */}
      <div className="flex flex-wrap gap-5 items-stretch">
        <div className="flex-1 min-w-0 basis-[520px] flex">
          {heroTrack ? (
            <div className={cn(RAISED_DARK, "p-6 w-full")}>
              <p className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-[#e1f073] mb-2.5">Next up · {heroDateLabel(heroTrack, now)}</p>
              <h2 className="text-[22px] font-bold leading-tight mb-1.5">
                {heroTrack.company} — {heroTrack.role}
              </h2>
              <p className="text-sm text-white/55 mb-5">
                {heroTrack.roundLabel} · {heroTrack.location}
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={() => onQuickPractice(heroTrack.id)} className={BUTTON_ACCENT}>
                  <Mic className="h-3.5 w-3.5" />
                  Run a practice session
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTrack(heroTrack.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3.5 py-2 text-xs font-bold text-white hover:border-white/60 transition-colors cursor-pointer">
                  Open this track
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <PrepEmptyState
              className="w-full justify-center"
              lottieSrc="/Lottie/neobrutalism/Video_Vlog_lottie.json"
              title="Nothing scheduled yet"
              body="Prep gets built around a job you're already talking to someone about — once one shows up in your tracker as Interviewing, it'll show up here too."
              ctaLabel="View your applications"
              ctaHref="/dashboard/tracker"
            />
          )}
        </div>

        <div className="flex-1 min-w-0 basis-[300px] flex">
          <div className={cn(PANEL, "p-6 flex flex-col justify-center gap-5 w-full")}>
            {active.length > 0 ? (
              <div className="flex items-center gap-5">
                <ScoreRing value={aggregateScore} size={104} />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-primary">Preparedness</p>
                  <p className="mt-1 text-xs leading-relaxed text-black/55">
                    Averaged across {active.length} active track{active.length === 1 ? "" : "s"}.
                  </p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-black/45">
                    {aggregateScore} out of 100
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3.5">
                <span className="h-11 w-11 flex-none rounded-full bg-[#f0f0ea] flex items-center justify-center">
                  <Target className="h-4 w-4 text-black/40" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary mb-0.5">Nothing to average yet</p>
                  <p className="text-xs text-black/50 leading-relaxed">Fills in once a job is actively interviewing.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full width — the list is the working surface of this screen. */}
      <div className={cn(PANEL, "overflow-hidden")}>
        <div className="flex items-center gap-3 flex-wrap px-5 py-3.5 border-b border-black/10">
          <span className="text-sm font-bold text-primary flex-none">All interviews</span>
          <span className="text-xs font-semibold text-black/40 flex-none tabular-nums">{filtered.length}</span>

          <div className="flex items-center gap-1.5 flex-wrap ml-4">
            {(
              [
                { id: "all", label: "All" },
                { id: "scheduled", label: "Scheduled" },
                { id: "needs-prep", label: "Needs prep" },
              ] as { id: Filter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterAndResetPage(f.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold cursor-pointer transition-colors",
                  filter === f.id ? "bg-[#222325] text-white" : "text-black/50 hover:bg-[#f0f0ea] hover:text-primary"
                )}>
                {f.label}
              </button>
            ))}
          </div>

          <div className={cn(FIELD_SHELL, "ml-auto min-w-[200px]")}>
            <Search className="h-3.5 w-3.5 text-black/40 flex-none" />
            <input
              value={query}
              onChange={(e) => setQueryAndResetPage(e.target.value)}
              placeholder="Role or company"
              className="flex-1 min-w-0 bg-transparent outline-none text-xs font-semibold text-primary placeholder:text-black/35 placeholder:font-medium"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-black/45">No interviews match your filters.</div>
        ) : (
          pageItems.map((t) => {
            const score = computePreparedness(t);
            const state = trackState(t, now);
            return (
              <div key={t.id} className="group flex items-center gap-4 px-5 py-3 border-b border-black/10 last:border-b-0 hover:bg-[#fbfbf7] transition-colors">
                <span className="h-9 w-9 flex-none rounded-lg bg-[#f0f0ea] flex items-center justify-center text-[11px] font-extrabold text-black/60">
                  {t.companyMark}
                </span>

                <button type="button" onClick={() => onOpenTrack(t.id)} className="min-w-0 flex-1 text-left cursor-pointer">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-bold text-primary truncate group-hover:underline underline-offset-2">
                      {t.company} — {t.role}
                    </span>
                    <Chip tone={state.tone}>{state.label}</Chip>
                  </span>
                  <span className="block text-xs text-black/45 truncate mt-0.5">{t.location}</span>
                </button>

                <span className="hidden md:block flex-none text-xs text-black/50 tabular-nums w-24 text-right">
                  {t.sessions.length} session{t.sessions.length === 1 ? "" : "s"}
                </span>
                <span className="hidden lg:block flex-none text-xs text-black/50 tabular-nums w-20 text-right">
                  {t.actions.filter((a) => a.done).length}/{t.actions.length} done
                </span>

                <ScoreRing value={score} size={34} label={<span className="text-[10.5px] font-bold text-primary tabular-nums">{score}</span>} />

                <button type="button" onClick={() => onOpenTrack(t.id)} aria-label={`Open prep for ${t.company} — ${t.role}`} className={ICON_BUTTON_PRESS}>
                  <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-3 flex-wrap">
          <span className="text-xs text-black/45 tabular-nums">
            {filtered.length === 0 ? "0 of 0" : `${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length}`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className={cn(ICON_BUTTON, "disabled:opacity-30 disabled:pointer-events-none")}>
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
            </button>
            {pageWindow(currentPage, totalPages).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-label={`Page ${n}`}
                aria-current={n === currentPage ? "page" : undefined}
                className={cn(
                  "h-8 w-8 rounded-lg text-xs font-bold cursor-pointer transition-colors tabular-nums",
                  n === currentPage ? "bg-[#222325] text-white" : "text-black/50 hover:bg-[#f0f0ea] hover:text-primary"
                )}>
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className={cn(ICON_BUTTON, "disabled:opacity-30 disabled:pointer-events-none")}>
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      <AddTrackDialog open={addOpen} onOpenChange={setAddOpen} onAdd={onAddTrack} existingTracks={tracksProp} />
    </div>
  );
};

export default PrepIndex;
