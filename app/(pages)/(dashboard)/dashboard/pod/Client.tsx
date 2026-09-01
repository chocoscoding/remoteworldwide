"use client";

import { FC, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Flame,
  Linkedin,
  LogOut,
  PauseCircle,
  PlayCircle,
  Settings2,
  Shuffle,
  Trophy,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import ShareWinModal from "@/app/components/dashboard/modals/ShareWinModal";
import SuggestGoalDialog, { type SuggestedGoalInput } from "@/app/components/dashboard/modals/SuggestGoalDialog";
import PauseSearchDialog from "@/app/components/dashboard/PauseSearchDialog";
import StreakFlame from "@/app/components/dashboard/streak/StreakFlame";
import ManageGoalsDialog from "@/app/components/dashboard/pod/ManageGoalsDialog";
import { usePod } from "@/app/components/dashboard/pod/PodProvider";
import { useWin } from "@/app/components/dashboard/win/WinProvider";
import { GOAL_KIND_META } from "@/app/components/dashboard/pod/pod-goal-meta";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { tierFor } from "@/app/lib/dashboard/streak";
import { NUDGE_LIMIT_PER_MEMBER_PER_DAY, podDayLogged, podQuorumCount } from "@/app/lib/dashboard/activity";
import { BOARD } from "@/app/lib/dashboard/mock-data";
import { photoOf } from "@/app/lib/dashboard/people-photos";

// ---------------------------------------------------------------------------
// The pod screen reads shared PodProvider state — the feed and the goals live
// at the shell level so a job win logged anywhere, or a milestone shared from
// the tracker, is already here when this page renders.
// ---------------------------------------------------------------------------

/** The one goal the dark hero's headline keys off. */
const DAILY_GOAL_ID = "goal-daily-apps";

/** Your own contribution to today's pod count — static mock, like BOARD. */
const MY_SENT_TODAY = 2;

/**
 * Photo when the member has one, initials when they don't — partial photo
 * coverage is the normal state. The wrapping element owns size, ring and
 * background; this only fills it.
 */
const Face: FC<{ name: string }> = ({ name }) => {
  const photo = photoOf(name);
  if (!photo) return <>{initials(name)}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo} alt="" className="h-full w-full object-cover" />;
};

/** First-and-last-initial for an avatar chip. "You" resolves to Amara's own initials. */
function initials(name: string): string {
  if (name === "You") return "AO";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const PodClient: FC = () => {
  const { moving, toggleFire, shareToPod, goals, suggestGoal } = usePod();
  const { openWinLog } = useWin();

  const [podOn, setPodOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  // Single-expand — only one member's contact row open at a time.
  const [openBoardRow, setOpenBoardRow] = useState<number | null>(null);
  const [rerolled, setRerolled] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);

  // Your own streak, shared with the Home header and the streak panel.
  const { current: myStreak, logPulse, loggedToday, goals: userGoals, pausedDaysLeft, resumeSearch, dailyTarget, todayIntensity } = useActivity();
  const myTier = tierFor(myStreak);

  // --- Pod streak -------------------------------------------------------
  const OTHERS_LOGGED = ["Priya Sharma", "Chidi Nwosu", "Funmi Adeyemi"];
  const [nudged, setNudged] = useState<string[]>([]);
  const [podStreakDays] = useState(9);

  const loggedNames = loggedToday ? [...OTHERS_LOGGED, "You"] : OTHERS_LOGGED;
  const quorum = podQuorumCount(BOARD.length);
  const podLoggedToday = podDayLogged(loggedNames.length, BOARD.length);

  const nudge = (name: string) => {
    if (nudged.includes(name)) return;
    setNudged((prev) => [...prev, name]);
    toast.success(`Nudged ${name.split(" ")[0]}.`, {
      description: `${NUDGE_LIMIT_PER_MEMBER_PER_DAY} nudge per person per day.`,
    });
  };

  const toggleBoardRow = (rank: number) => setOpenBoardRow((prev) => (prev === rank ? null : rank));

  const handleShareConfirm = () => {
    setShareOpen(false);
    shareToPod("You shared an interview win 🎉", { hot: true });
    toast.success("Shared with your pod", { description: "It's on What's moving — they'll see it." });
  };

  const handleSuggestGoal = (input: SuggestedGoalInput) => {
    suggestGoal(input);
    setSuggestOpen(false);
  };

  const activeGoals = goals.filter((g) => g.status === "active");
  const votingCount = goals.filter((g) => g.status !== "active").length;

  const dailyGoal = goals.find((g) => g.id === DAILY_GOAL_ID);
  const podGoalTarget = dailyGoal?.target ?? 0;
  const podGoalCurrent = dailyGoal?.current ?? 0;
  const podPct = podGoalTarget > 0 ? Math.round((podGoalCurrent / podGoalTarget) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="whitespace-nowrap text-[17px] font-bold text-primary">Your pod</h1>
          <span className="truncate text-sm text-black/45">Resets Sunday · Week 3</span>
        </div>
        <div className="flex flex-none items-center gap-3">
          <StickerButton variant="outline" size="md" onClick={() => setMuted((v) => !v)}>
            {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {muted ? "Muted" : "Mute"}
          </StickerButton>
          <StickerButton variant="primary" size="md" onClick={() => setShareOpen(true)}>
            <Trophy className="h-4 w-4" />
            Share a win
          </StickerButton>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-8 py-7 pb-14">
        {!podOn ? (
          // -----------------------------------------------------------------
          // Solo mode
          // -----------------------------------------------------------------
          <DashCard className="mx-auto mt-16 max-w-md p-10 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0f0ea] text-black/40">
              <UsersRound className="h-6 w-6" />
            </div>
            <p className="text-lg font-bold text-primary">You&apos;re in solo mode</p>
            <p className="mt-2 text-sm leading-relaxed text-black/50">
              Job seekers in a pod apply 2.4× more consistently. Get matched with 6 other Product Designers at your level, in
              your timezone, going through the same thing right now.
            </p>
            <StickerButton variant="primary" size="lg" className="mt-6" onClick={() => setPodOn(true)}>
              Join a pod
            </StickerButton>
          </DashCard>
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_360px]">
            {/* Left column */}
            <div className="flex min-w-0 flex-col gap-5">
              {/* Dark hero — identity and today's shared number. Goal
                  management moved to a popup; the hero stays a hero. */}
              <div className="relative overflow-hidden rounded-[18px] bg-primary p-7 text-white">
                <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-secondary/25 blur-3xl" />
                <div className="relative">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-secondary">
                    Product Designers · 3–5 yrs · Remote
                  </p>

                  <div className="mb-5 flex items-center">
                    <div className="flex items-center -space-x-2">
                      {BOARD.map((row) => (
                        <div
                          key={row.rank}
                          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/15 text-[11px] font-bold text-white ring-2 ring-primary">
                          <Face name={row.name} />
                        </div>
                      ))}
                    </div>
                    <span className="ml-3 text-sm text-white/55">{BOARD.length} people</span>
                  </div>

                  <p className="mb-5 max-w-md text-2xl font-bold leading-snug">
                    Your pod is going for {podGoalTarget} applications today — {podGoalCurrent} are in.
                  </p>

                  <ProgressBar value={podPct} dark height="h-[9px]" className="mb-3" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-white/55">You&apos;ve sent {MY_SENT_TODAY} of them.</p>
                    <button
                      type="button"
                      onClick={() => setManageOpen(true)}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/25 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-white/60">
                      <Settings2 className="h-3.5 w-3.5" />
                      Manage goals
                      {votingCount > 0 && (
                        <span className="grid h-4 w-4 place-content-center rounded-full bg-secondary text-[10px] font-bold text-primary">
                          {votingCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Today's goals — all of them, on landing, each with the
                  utility that carries you to where the work happens. */}
              <DashCard className="p-6">
                <p className="mb-1 text-[15px] font-bold text-primary">Today&apos;s goals</p>
                <p className="mb-4 text-xs text-black/60">What the pod is working toward — do your part where the work lives.</p>

                <div className="flex flex-col gap-2.5">
                  {activeGoals.map((goal) => {
                    const meta = GOAL_KIND_META[goal.kind];
                    const Icon = meta.icon;
                    const pct = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;
                    const done = goal.current >= goal.target;
                    return (
                      <div key={goal.id} className="rounded-xl border border-black/10 bg-[#fbfbf7] p-4">
                        <div className="flex items-center gap-3">
                          <span className={cn("grid h-9 w-9 flex-none place-content-center rounded-lg", done ? "bg-[#e1f073]" : "bg-[#f0f0ea]")}>
                            {done ? <Check className="h-4 w-4 text-[#222325]" strokeWidth={3} /> : <Icon className="h-4 w-4 text-[#222325]" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-primary">{goal.label}</p>
                            <p className="text-[11px] text-black/55">
                              {goal.current} of {goal.target} {goal.unit}
                            </p>
                          </div>
                          {goal.kind === "job-win" ? (
                            <button
                              type="button"
                              onClick={openWinLog}
                              className="inline-flex flex-none cursor-pointer items-center gap-1 text-xs font-semibold text-primary underline decoration-2 underline-offset-4 transition-colors hover:decoration-[#6c7a1e]">
                              {meta.actionLabel}
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          ) : meta.href && meta.actionLabel ? (
                            <Link
                              href={meta.href}
                              className="inline-flex flex-none items-center gap-1 text-xs font-semibold text-primary underline decoration-2 underline-offset-4 transition-colors hover:decoration-[#6c7a1e]">
                              {meta.actionLabel}
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          ) : null}
                        </div>
                        <ProgressBar value={pct} height="h-1.5" className="mt-3" />
                      </div>
                    );
                  })}
                </div>
              </DashCard>

              {/* What's moving — the fire is the only reaction. */}
              <DashCard className="p-6">
                <p className="mb-1 text-[15px] font-bold text-primary">What&apos;s moving</p>
                <p className="mb-4 text-xs text-black/60">Live updates from your pod.</p>
                <div className="flex flex-col gap-2.5">
                  {moving.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-lg border border-black/10 bg-[#fbfbf7] p-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-primary">{item.text}</p>
                          {item.hot && <Pill variant="urgent">Hot</Pill>}
                        </div>
                        <p className="mt-0.5 text-xs text-black/40">
                          {item.time}
                          {item.mine && " · shared by you"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFire(item.id)}
                        aria-pressed={item.firedByMe}
                        className={cn(
                          "inline-flex flex-none cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                          item.firedByMe
                            ? "border-secondary bg-secondary text-primary"
                            : "border-black/10 text-black/50 hover:border-black/25"
                        )}>
                        <Flame className="h-3.5 w-3.5" />
                        {item.fires}
                      </button>
                    </div>
                  ))}
                </div>
              </DashCard>
            </div>

            {/* Right rail */}
            <div className="flex min-w-0 flex-col gap-5">
              {/* Pod streak — one number, one avatar strip, one line. A pod
                  day counts when 60% of members log, so nobody carries it. */}
              <DashCard className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[32px] font-extrabold leading-none tabular-nums text-primary">{podStreakDays}</span>
                    <span className="text-sm text-black/55">days together</span>
                  </div>
                  <Pill variant={podLoggedToday ? "positive" : "neutral"} className="flex-none">
                    {podLoggedToday ? "Today counts" : `${quorum - loggedNames.length} more needed`}
                  </Pill>
                </div>

                <div className="mt-4 flex items-center gap-1.5">
                  {BOARD.map((row) => {
                    const done = loggedNames.includes(row.name);
                    return (
                      <span key={row.rank} title={`${row.name}${done ? " — logged today" : " — not yet"}`} className="relative flex-none">
                        <span
                          className={cn(
                            "grid h-9 w-9 place-content-center overflow-hidden rounded-full text-[11px] font-bold",
                            done ? "bg-secondary text-primary ring-2 ring-[#222325]" : "bg-[#f0f0ea] text-black/40"
                          )}>
                          <Face name={row.name} />
                        </span>
                        {done && (
                          <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-content-center rounded-full bg-secondary ring-[1.5px] ring-[#222325]">
                            <Check className="h-2.5 w-2.5 text-[#222325]" strokeWidth={3.5} />
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-black/60">
                  {podLoggedToday
                    ? "Quorum reached — today counts for everyone."
                    : `${loggedNames.length} of ${quorum} logged. ${quorum - loggedNames.length} more keeps it alive.`}
                  {todayIntensity >= dailyTarget && (
                    <span className="ml-1 font-bold text-[#6c7a1e]">You put in a full day.</span>
                  )}
                </p>

                {/* Logging lives in the tracker; nudging lives here. */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {!loggedToday && (
                    <Link
                      href="/dashboard/tracker"
                      className="inline-flex items-center gap-1 rounded-full bg-[#222325] px-3 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90">
                      Log yours in the tracker
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                  {BOARD.filter((row) => !row.me && !loggedNames.includes(row.name)).map((row) => {
                    const alreadyNudged = nudged.includes(row.name);
                    return (
                      <button
                        key={row.rank}
                        type="button"
                        onClick={() => nudge(row.name)}
                        disabled={alreadyNudged}
                        className="flex-none cursor-pointer rounded-full border border-black/15 px-2.5 py-1.5 text-[11px] font-semibold text-black/55 transition-colors hover:border-[#222325] hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-black/15">
                        {alreadyNudged ? `Nudged ${row.name.split(" ")[0]}` : `Nudge ${row.name.split(" ")[0]}`}
                      </button>
                    );
                  })}
                </div>
              </DashCard>

              {/* Leaderboard */}
              <DashCard className="p-6">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <p className="text-[15px] font-bold text-primary">This week</p>
                  <span
                    title={`Your current streak: ${myStreak} days`}
                    className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-[#222325] bg-secondary px-2 py-1 text-[11px] font-bold text-primary shadow-[2px_2px_0_0_#222325]">
                    <StreakFlame tier={myTier} size={12} pulse={logPulse} dimmed={myStreak === 0} />
                    {myStreak}d
                  </span>
                </div>
                <p className="mb-3 text-xs text-black/45">Streaks and applications logged since Monday.</p>
                <div className="flex flex-col">
                  {BOARD.map((row) => {
                    const isOpen = openBoardRow === row.rank;
                    return (
                      <div key={row.rank} className="border-b border-black/8 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => !row.me && toggleBoardRow(row.rank)}
                          className={cn(
                            "-mx-2 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
                            row.me ? "border-2 border-[#222325] bg-secondary/70" : "cursor-pointer border-2 border-transparent hover:bg-[#f6f6f6]"
                          )}>
                          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-black/10 bg-white text-[11px] font-bold text-primary">
                            {row.rank}
                          </span>
                          <span className="flex h-7 w-7 flex-none items-center justify-center overflow-hidden rounded-full bg-[#222325] text-[10px] font-bold text-white">
                            <Face name={row.name} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-primary">{row.name}</span>
                            <span className="flex items-center gap-1 text-[11px] text-black/45">
                              {row.me ? (
                                <>
                                  <StreakFlame tier={myTier} size={11} pulse={logPulse} dimmed={myStreak === 0} />
                                  {myStreak}-day streak
                                </>
                              ) : (
                                <>
                                  <span aria-hidden>🔥</span>
                                  {row.streak}-day streak
                                </>
                              )}
                            </span>
                          </span>
                          <span className="flex-none text-sm font-bold text-primary">{row.apps}</span>
                          {!row.me && (
                            <ChevronDown className={cn("h-3.5 w-3.5 flex-none text-black/35 transition-transform", isOpen && "rotate-180")} />
                          )}
                        </button>
                        {isOpen && !row.me && (
                          <div className="-mt-0.5 pb-3 pl-11">
                            <a
                              href="https://www.linkedin.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                              <Linkedin className="h-3.5 w-3.5" />
                              Connect on LinkedIn
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </DashCard>

              {/* Pod settings */}
              <DashCard className="p-6">
                <p className="mb-1 text-[15px] font-bold text-primary">Pod settings</p>
                <p className="mb-4 text-xs leading-relaxed text-black/45">
                  Matched by role, experience band and timezone — Product Designers, 3–5 yrs, GMT±2.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setMuted((v) => !v)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border-[1.5px] border-black/12 px-3.5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-[#222325] hover:bg-[#f6f6f6]">
                    <span className="inline-flex items-center gap-2">
                      {muted ? <BellOff className="h-3.5 w-3.5 text-black/45" /> : <Bell className="h-3.5 w-3.5 text-black/45" />}
                      {muted ? "Unmute pod notifications" : "Mute pod notifications"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRerolled(true)}
                    disabled={rerolled}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border-[1.5px] border-black/12 px-3.5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-[#222325] hover:bg-[#f6f6f6] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-black/12 disabled:hover:bg-transparent">
                    <span className="inline-flex items-center gap-2">
                      <Shuffle className="h-3.5 w-3.5 text-black/45" />
                      {rerolled ? "Rerolled this week" : "Reroll my pod"}
                    </span>
                    {!rerolled && <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-black/35">1× / week</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => (userGoals.paused ? resumeSearch() : setPauseOpen(true))}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border-[1.5px] border-black/12 px-3.5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-[#222325] hover:bg-[#f6f6f6]">
                    <span className="inline-flex items-center gap-2">
                      {userGoals.paused ? (
                        <PlayCircle className="h-3.5 w-3.5 text-black/45" />
                      ) : (
                        <PauseCircle className="h-3.5 w-3.5 text-black/45" />
                      )}
                      {userGoals.paused ? "Resume your search" : "Pause your search"}
                    </span>
                    {userGoals.paused && pausedDaysLeft !== null && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-black/35">{pausedDaysLeft}d left</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPodOn(false)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border-[1.5px] border-black/12 px-3.5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-[#222325] hover:bg-[#f6f6f6]">
                    <span className="inline-flex items-center gap-2">
                      <LogOut className="h-3.5 w-3.5 text-black/45" />
                      Leave this pod
                    </span>
                  </button>
                </div>
              </DashCard>
            </div>
          </div>
        )}
      </main>

      <ShareWinModal open={shareOpen} onOpenChange={setShareOpen} tier="Interview" onConfirm={handleShareConfirm} />
      {manageOpen && <ManageGoalsDialog onClose={() => setManageOpen(false)} onSuggest={() => setSuggestOpen(true)} />}
      <SuggestGoalDialog open={suggestOpen} onOpenChange={setSuggestOpen} onSuggest={handleSuggestGoal} />
      <PauseSearchDialog open={pauseOpen} onOpenChange={setPauseOpen} />
    </div>
  );
};

export default PodClient;
