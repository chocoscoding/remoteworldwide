"use client";

import { FC, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { format, subDays } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, Download, PartyPopper, PenLine, Search, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";
import JobPickerDialog from "@/app/components/dashboard/jobs/JobPickerDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLUMN_LABELS, COLUMN_META, STATUS_ORDER } from "@/app/components/dashboard/tracker/tracker-meta";
import { PLATFORM_JOBS, createPastedJob, type JobOption, type PastedJobInput } from "@/app/lib/dashboard/job-options";
import { TRACKER_COLUMNS } from "@/app/lib/dashboard/mock-data";
import { WIN_SALARY_PREFILL, WIN_STATS_PULL, type WinJourneyStep, type WinRecord } from "@/app/lib/dashboard/win";
import type { TrackerColumnId } from "@/app/lib/dashboard/types";

/**
 * The win log. Four screens, each one question deep: which application won,
 * the road it took, your numbers, your story.
 *
 * The job comes from the application tracker first — that's where the truth
 * lives. No tracker card? Import one, or type the two facts by hand. The road
 * prefills what the tracker recorded and leaves the rest editable, because
 * the edge case is real: a job imported at "Saved" still has an apply date,
 * an interview date and an offer date — the user knows them even when the
 * board never did.
 *
 * Mount only while open: closing throws the draft away for free.
 */
export interface WinLogDialogProps {
  /** The live streak count, frozen into the record at submit. */
  streak: number;
  onClose: () => void;
  onComplete: (win: WinRecord) => void;
}

const STORY_GUIDE = 300;

const STEP_TITLES = ["The job", "The road", "The numbers", "The story"] as const;

const FIELD =
  "w-full rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-sm text-primary outline-none transition-colors focus:border-[#222325]";

const LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-black/50";

interface TrackerJobRow {
  cardId: string;
  title: string;
  company: string;
  columnId: TrackerColumnId;
  daysAgo?: number;
  rww?: boolean;
}

/**
 * Every card on the board, most advanced stage first — the job that won is
 * almost always near the offer end. Reads the tracker's seed data; a real
 * build reads the live board.
 */
const TRACKER_JOBS: TrackerJobRow[] = [...STATUS_ORDER].reverse().flatMap((columnId) =>
  (TRACKER_COLUMNS.find((c) => c.id === columnId)?.cards ?? []).map((card) => ({
    cardId: card.id,
    title: card.title,
    company: card.company,
    columnId,
    daysAgo: card.daysAgo,
    rww: card.rww,
  })),
);

/** The five milestones a road can carry, in order. Empty dates fall off the card. */
const ROAD_STEPS: { id: string; label: (rww: boolean) => string }[] = [
  { id: "saved", label: () => "Saved the role" },
  { id: "applied", label: (rww) => (rww ? "Applied on Remote Worldwide" : "Applied") },
  { id: "conversation", label: () => "First conversation" },
  { id: "interviews", label: () => "Interview loops" },
  { id: "offer", label: () => "Offer accepted" },
];

type RoadDates = Record<string, Date | undefined>;

const WinLogDialog: FC<WinLogDialogProps> = ({ streak, onClose, onComplete }) => {
  // Read once, lazily — today anchors the road's date math and stays stable.
  const [today] = useState(() => new Date());

  const [step, setStep] = useState(0);

  // --- Step 1: the job -----------------------------------------------------
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<TrackerJobRow | null>(null);
  const [manual, setManual] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [isRww, setIsRww] = useState(false);

  // --- Step 2: the road ----------------------------------------------------
  const [road, setRoad] = useState<RoadDates>({ offer: today });

  // --- Steps 3+4 -------------------------------------------------------------
  const [salary, setSalary] = useState(WIN_SALARY_PREFILL);
  const [story, setStory] = useState("");
  const [shareAnonymously, setShareAnonymously] = useState(true);
  const [featureWithName, setFeatureWithName] = useState(false);

  const filtered = TRACKER_JOBS.filter((j) => `${j.company} ${j.title}`.toLowerCase().includes(query.trim().toLowerCase()));

  /** Selecting a card seeds the road with everything the tracker knows. */
  function pickTrackerJob(job: TrackerJobRow) {
    setPicked(job);
    setManual(false);
    setCompany(job.company);
    setRole(job.title);
    setIsRww(!!job.rww);
    const seeded: RoadDates = { offer: today };
    // `daysAgo` means "saved N days ago" in the Saved column and "applied N
    // days ago" everywhere else — same reading as the tracker's own timeline.
    if (job.daysAgo !== undefined) {
      if (job.columnId === "saved") seeded.saved = subDays(today, job.daysAgo);
      else seeded.applied = subDays(today, job.daysAgo);
    }
    setRoad(seeded);
  }

  /** An imported job has no tracker history — the road starts at the offer. */
  function pickImportedJob(job: JobOption) {
    setPicked(null);
    setManual(true);
    setCompany(job.company);
    setRole(job.role);
    setIsRww(job.source === "platform");
    setRoad({ offer: today });
    setImportOpen(false);
  }

  function startManual() {
    setPicked(null);
    setManual(true);
    setCompany("");
    setRole("");
    setIsRww(false);
    setRoad({ offer: today });
  }

  const jobValid = company.trim() !== "" && role.trim() !== "";
  const roadValid = road.offer instanceof Date;
  // One popover open at a time — selecting a day closes it.
  const [openRoadId, setOpenRoadId] = useState<string | null>(null);

  const pulledStats = [
    { id: "apps", value: WIN_STATS_PULL.applications, label: "applications sent" },
    { id: "loops", value: WIN_STATS_PULL.interviewLoops, label: "interview loops" },
    { id: "streak", value: streak, label: "day streak" },
    { id: "referral", value: WIN_STATS_PULL.referralsUsed, label: "referral used" },
  ];

  function submit() {
    const journey: WinJourneyStep[] = ROAD_STEPS.filter((r) => road[r.id] instanceof Date).map((r) => ({
      id: `j-${r.id}`,
      dateLabel: format(road[r.id]!, "d MMM"),
      label: r.label(isRww),
    }));

    onComplete({
      facts: { company: company.trim(), role: role.trim(), offerDateLabel: format(road.offer ?? today, "d MMMM") },
      stats: { ...WIN_STATS_PULL, streak, salaryDelta: salary.trim() === "" ? null : salary.trim() },
      journey,
      story: story.trim(),
      shareAnonymously,
      featureWithName,
    });
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-none items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                {STEP_TITLES.map((t, i) => (
                  <span
                    key={t}
                    className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-[#222325]" : "w-1.5 bg-black/15")}
                  />
                ))}
              </div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">{STEP_TITLES[step]}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-black/60">
                {step === 0 && "Which application turned into the offer? Your tracker knows most of them."}
                {step === 1 && "The dates on your card. The tracker filled what it saw — set the rest yourself."}
                {step === 2 && "Your numbers, pulled for you. Nothing to type."}
                {step === 3 && "One honest line for the person six weeks behind you."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-neo">
            {step === 0 && !manual && (
              <div className="flex flex-col gap-3 px-6 pb-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/35" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your tracker"
                    className={cn(FIELD, "pl-9")}
                  />
                </div>

                <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto scrollbar-neo pr-0.5 border-b border-b-secondary">
                  {filtered.map((job) => {
                    const isPicked = picked?.cardId === job.cardId;
                    return (
                      <button
                        key={job.cardId}
                        type="button"
                        aria-pressed={isPicked}
                        onClick={() => pickTrackerJob(job)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                          isPicked ? "border-[#222325] bg-[#f7fbe4]" : "border-black/12 bg-white hover:border-black/30",
                        )}>
                        <Avatar name={job.company} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-primary">{job.company}</span>
                          <span className="block truncate text-[11px] text-black/60">{job.title}</span>
                        </span>
                        <span className={cn("flex-none rounded-full px-2 py-0.5 text-[10px] font-bold", COLUMN_META[job.columnId].pill)}>
                          {COLUMN_LABELS[job.columnId]}
                        </span>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <p className="rounded-xl border border-dashed border-black/20 px-3 py-4 text-center text-xs text-black/55">
                      Nothing on your board matches — import it or enter it below.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-[#222325]">
                    <Download className="h-3.5 w-3.5" />
                    Import a job
                  </button>
                  <button
                    type="button"
                    onClick={startManual}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-black/60 transition-colors hover:bg-black/[0.05] hover:text-primary">
                    <PenLine className="h-3.5 w-3.5" />
                    Enter it manually
                  </button>
                </div>
              </div>
            )}

            {step === 0 && manual && (
              <div className="flex flex-col gap-4 px-6 pb-2">
                <div>
                  <label htmlFor="win-company" className={LABEL}>
                    Company
                  </label>
                  <input id="win-company" value={company} onChange={(e) => setCompany(e.target.value)} className={FIELD} />
                </div>
                <div>
                  <label htmlFor="win-role" className={LABEL}>
                    Role
                  </label>
                  <input id="win-role" value={role} onChange={(e) => setRole(e.target.value)} className={FIELD} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setManual(false);
                    setPicked(null);
                  }}
                  className="cursor-pointer self-start text-xs font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                  Pick from your tracker instead
                </button>
              </div>
            )}

            {step === 1 && (
              <div className="px-6 pb-2">
                <div className="flex flex-col gap-2">
                  {ROAD_STEPS.map((r, i) => {
                    const last = i === ROAD_STEPS.length - 1;
                    const value = road[r.id];
                    return (
                      <div key={r.id} className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 flex-none rounded-full",
                            last ? "bg-[#e1f073] ring-2 ring-[#222325]" : value ? "bg-[#222325]" : "bg-black/15",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">
                          {r.label(isRww)}
                          {last && <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-black/40">required</span>}
                        </span>
                        <Popover open={openRoadId === r.id} onOpenChange={(o) => setOpenRoadId(o ? r.id : null)}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "inline-flex w-[116px] flex-none cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold tabular-nums transition-colors",
                                value
                                  ? "border-black/12 bg-white text-primary hover:border-[#222325]"
                                  : "border-dashed border-black/20 text-black/40 hover:border-black/40",
                              )}>
                              <CalendarDays className="h-3 w-3 flex-none" />
                              {value ? format(value, "d MMM") : "Pick a day"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            // z-[60] + pointer-events-auto: the modal win-log
                            // dialog sets pointer-events:none on <body>, which
                            // this sibling portal inherits — without the reset
                            // the calendar paints but can't be clicked. The z
                            // keeps it above the dialog's own z-50.
                            className="pointer-events-auto z-[60] w-auto rounded-xl border-[1.5px] border-[#222325] p-0 shadow-[4px_4px_0_0_#222325]">
                            <Calendar
                              mode="single"
                              selected={value}
                              defaultMonth={value ?? today}
                              disabled={{ after: today }}
                              onSelect={(day) => {
                                // Re-clicking the selected day clears an optional
                                // step; the offer date always keeps a value.
                                setRoad((prev) => ({ ...prev, [r.id]: day ?? (last ? prev[r.id] : undefined) }));
                                setOpenRoadId(null);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 rounded-lg bg-[#f0f0ea] px-3.5 py-2.5 text-[11px] leading-relaxed text-black/60">
                  Steps without a date stay off the card. Pick a day to set one; click the selected day again to clear an
                  optional step.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="px-6 pb-2">
                <div className="grid grid-cols-2 gap-2.5">
                  {pulledStats.map((s) => (
                    <div key={s.id} className="rounded-xl border border-black/10 bg-[#fbfbf7] px-4 py-3">
                      <p className="text-2xl font-bold leading-none tabular-nums text-primary">{s.value}</p>
                      <p className="mt-1.5 text-xs text-black/60">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <label htmlFor="win-salary" className={LABEL}>
                    Negotiated up <span className="font-medium normal-case tracking-normal text-black/40">— optional, clear to skip</span>
                  </label>
                  <input
                    id="win-salary"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="e.g. +$12k"
                    className={FIELD}
                  />
                  <p className="mt-1.5 text-[11px] text-black/50">Hidden on the share card unless you switch it on.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="px-6 pb-2">
                <label htmlFor="win-story" className={LABEL}>
                  What actually moved the needle for you?
                </label>
                <AutoGrowTextarea
                  id="win-story"
                  minRows={3}
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="A habit, a rewrite, a hard conversation you're glad you had..."
                  className={cn(FIELD, "leading-relaxed")}
                />
                <p
                  className={cn(
                    "mt-1 text-right text-[11px] tabular-nums",
                    story.length > STORY_GUIDE ? "font-semibold text-[#b23c26]" : "text-black/40",
                  )}>
                  {story.length}/{STORY_GUIDE}
                </p>

                <div className="mt-3 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShareAnonymously((v) => !v)}
                    className="flex cursor-pointer items-start gap-2.5 text-left">
                    <NeoCheckbox checked={shareAnonymously} size="sm" interactive />
                    <span className="text-xs leading-snug text-black/70">
                      Share this anonymously with the community — never with your name.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeatureWithName((v) => !v)}
                    className="flex cursor-pointer items-start gap-2.5 text-left">
                    <NeoCheckbox checked={featureWithName} size="sm" interactive />
                    <span className="text-xs leading-snug text-black/70">Remote Worldwide may feature this with my name.</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-none items-center justify-between gap-2.5 border-t border-black/10 px-6 py-4">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-black/60 transition-colors hover:bg-black/[0.05] hover:text-primary">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : (
              <span className="text-[11px] text-black/40">Takes about 90 seconds</span>
            )}

            {step < 3 ? (
              <StickerButton
                variant="primary"
                size="md"
                disabled={(step === 0 && !jobValid) || (step === 1 && !roadValid)}
                onClick={() => setStep((s) => s + 1)}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </StickerButton>
            ) : (
              <StickerButton variant="primary" size="md" onClick={submit}>
                <PartyPopper className="h-4 w-4" />
                Log my win
              </StickerButton>
            )}
          </div>

          {step === 3 && (
            <p className="flex flex-none items-center gap-1.5 border-t border-black/8 bg-[#fbfbf7] px-6 py-2.5 text-[11px] text-black/50">
              <Trophy className="h-3 w-3 flex-none" />
              Logging your win retires your {streak}-day streak at its final count and puts the news on your pod&apos;s board — no buttons,
              it just happens.
            </p>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>

      {/* Same import flow the tracker's "Add job" uses. */}
      <JobPickerDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        jobs={PLATFORM_JOBS}
        onPick={pickImportedJob}
        onCreate={(input: PastedJobInput) => pickImportedJob(createPastedJob(input))}
      />
    </DialogPrimitive.Root>
  );
};

export default WinLogDialog;
