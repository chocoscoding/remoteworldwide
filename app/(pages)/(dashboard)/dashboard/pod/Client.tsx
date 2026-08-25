"use client";

import { FC, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Flame,
  Linkedin,
  Lock,
  LogOut,
  Plus,
  PauseCircle,
  PlayCircle,
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
import RewardModal from "@/app/components/dashboard/modals/RewardModal";
import SuggestGoalDialog, { type SuggestedGoalInput } from "@/app/components/dashboard/modals/SuggestGoalDialog";
import PauseSearchDialog from "@/app/components/dashboard/PauseSearchDialog";
import StreakFlame from "@/app/components/dashboard/streak/StreakFlame";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { tierFor } from "@/app/lib/dashboard/streak";
import { NUDGE_LIMIT_PER_MEMBER_PER_DAY, podDayLogged, podQuorumCount } from "@/app/lib/dashboard/activity";
import { BOARD, FEED, POD_GOALS, WEEKLY_GOAL } from "@/app/lib/dashboard/mock-data";
import type { PodGoal } from "@/app/lib/dashboard/types";

// ---------------------------------------------------------------------------
// Local content/state shapes that aren't shared with any other screen.
// ---------------------------------------------------------------------------

/** Majority needed to resolve a goal vote — derived from pod size, not hardcoded. */
const VOTE_MAJORITY = Math.floor(BOARD.length / 2) + 1;

/** The one PodGoal the dark hero and the "Log one" affordance key off of. */
const DAILY_GOAL_ID = "goal-daily-apps";

interface FeedItemState {
  fired: boolean;
  count: number;
  congratsSent: boolean;
}

function initialFeedState(): Record<string, FeedItemState> {
  return Object.fromEntries(FEED.map((item) => [item.id, { fired: false, count: item.n, congratsSent: false }]));
}

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
  const [podOn, setPodOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [feedState, setFeedState] = useState<Record<string, FeedItemState>>(initialFeedState);
  // Single-expand, not a Set — only one member's contact row open at a time
  // so the list never shows several expanded rows stacked on top of each other.
  const [openBoardRow, setOpenBoardRow] = useState<number | null>(null);
  const [rerolled, setRerolled] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);

  // Pod goals + voting — collapsed by default inside the hero so the screen
  // doesn't dump the full goals/voting list on every visit.
  const [goals, setGoals] = useState<PodGoal[]>(POD_GOALS);
  const [goalsPanelOpen, setGoalsPanelOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  // How many applications *you* (not the whole pod) have sent today, and your
  // own weekly count — mirrors WEEKLY_GOAL.current from the Home screen so
  // "Log one" visibly nudges the same number Home tracks, without wiring up
  // real cross-screen shared state.
  const [mySentToday, setMySentToday] = useState(2);
  const [myWeeklyApps, setMyWeeklyApps] = useState(WEEKLY_GOAL.current);
  // Read once on mount, not on every render — feeds the 7-day voting-window
  // math below without calling the impure Date.now() from render itself.
  const [now] = useState(() => Date.now());

  // Your own streak, shared with the Home header and the streak panel.
  const { current: myStreak, logPulse, openLog, loggedToday, goals: userGoals, pausedDaysLeft, resumeSearch } = useActivity();
  const myTier = tierFor(myStreak);

  // --- Pod streak -------------------------------------------------------
  // Everyone but you is mock; your own row is live, so logging anywhere in the
  // app moves the pod's number too.
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

  const toggleFire = (id: string) => {
    setFeedState((prev) => {
      const current = prev[id];
      const fired = !current.fired;
      return { ...prev, [id]: { ...current, fired, count: current.count + (fired ? 1 : -1) } };
    });
  };

  const sendCongrats = (id: string) => {
    setFeedState((prev) => ({ ...prev, [id]: { ...prev[id], congratsSent: true } }));
  };

  const toggleBoardRow = (rank: number) => {
    setOpenBoardRow((prev) => (prev === rank ? null : rank));
  };

  const handleShareConfirm = () => {
    setShareOpen(false);
    setRewardOpen(true);
  };

  /** Proposes removing an active, non-protected goal — flips it in place to "voting-remove". */
  const suggestRemoval = (goalId: string) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, status: "voting-remove", proposedBy: "You", votes: [], proposedAt: new Date().toISOString() } : g
      )
    );
  };

  /** Appends a brand-new goal proposal from the "Suggest a goal" dialog. */
  const handleSuggestGoal = (input: SuggestedGoalInput) => {
    setGoals((prev) => [
      ...prev,
      {
        id: `goal-custom-${prev.length}`,
        label: input.label,
        target: input.target,
        current: 0,
        unit: input.unit,
        protected: false,
        proposedBy: "You",
        votes: [],
        status: "voting-add",
        proposedAt: new Date().toISOString(),
      },
    ]);
    setSuggestOpen(false);
  };

  /**
   * Casts "You"'s vote on a proposal. Reaching a "for" majority resolves it
   * immediately (activates an add, deletes a removal target) — good news
   * doesn't need to wait. Votes "against" never resolve a proposal early:
   * they just accumulate in the tally, and a proposal that never reaches a
   * "for" majority quietly expires on its own 7-day window instead (see
   * `withVotingMeta` below). Reads `goals` from the closure rather than an
   * updater's `prev` so the toast (a side effect) never lives inside a
   * setState updater, which React may invoke more than once.
   */
  const castVote = (goalId: string, choice: "for" | "against") => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const votes = [...goal.votes, { memberName: "You", choice }];
    const forCount = votes.filter((v) => v.choice === "for").length;

    if (forCount >= VOTE_MAJORITY) {
      if (goal.status === "voting-add") {
        setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, status: "active", votes } : g)));
        toast.success(`"${goal.label}" is now a pod goal.`);
      } else {
        setGoals((prev) => prev.filter((g) => g.id !== goalId));
        toast.success(`"${goal.label}" was voted out.`);
      }
      return;
    }

    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, votes } : g)));
  };

  /**
   * "Log one" on the daily-apps goal — bumps the shared pod count, your own
   * daily/weekly counts, and your personal streak. One application logged is
   * one application logged: it should not matter which screen you were on
   * when you logged it, so this opens the same log dialog the Home header
   * does — the artifact is what makes the day count.
   */
  const logApplication = () => {
    const goal = goals.find((g) => g.id === DAILY_GOAL_ID);
    if (!goal || goal.current >= goal.target) return;

    const nextCurrent = goal.current + 1;
    setGoals((prev) => prev.map((g) => (g.id === DAILY_GOAL_ID ? { ...g, current: nextCurrent } : g)));
    setMySentToday((n) => n + 1);
    setMyWeeklyApps((n) => n + 1);
    // Routes through the same dialog as everywhere else: a pod tally still
    // needs an artifact behind it, so this can't shortcut the log.
    openLog();

    if (nextCurrent >= goal.target) {
      toast.success(`Pod goal complete — "${goal.label}"!`);
    }
  };

  const dailyGoal = goals.find((g) => g.id === DAILY_GOAL_ID);
  const podGoalTarget = dailyGoal?.target ?? 0;
  const podGoalCurrent = dailyGoal?.current ?? 0;
  const podPct = podGoalTarget > 0 ? Math.round((podGoalCurrent / podGoalTarget) * 100) : 0;

  // A voting proposal gets a real 7-day window from `proposedAt`. It never
  // resolves early just because it's trending "against" — it only leaves the
  // list by winning a "for" majority (handled in castVote) or by the window
  // running out, computed here off the wall clock rather than a fake timer.
  const withVotingMeta = goals
    .map((g) => ({ ...g, daysLeft: g.proposedAt ? Math.max(0, 7 - Math.floor((now - new Date(g.proposedAt).getTime()) / 86_400_000)) : 0 }))
    .filter((g) => g.status === "active" || g.daysLeft > 0);
  const activeGoals = withVotingMeta.filter((g) => g.status === "active");
  const votingGoals = withVotingMeta.filter((g) => g.status !== "active");

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Your pod</h1>
          <span className="text-sm text-black/45 truncate">Resets Sunday · Week 3</span>
        </div>
        <div className="flex items-center gap-3 flex-none">
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

      <main className="px-8 py-7 pb-14 max-w-[1180px] mx-auto">
        {!podOn ? (
          // -----------------------------------------------------------------
          // Solo mode
          // -----------------------------------------------------------------
          <DashCard className="max-w-md mx-auto mt-16 p-10 text-center">
            <div className="h-14 w-14 rounded-full bg-[#f0f0ea] text-black/40 flex items-center justify-center mx-auto mb-5">
              <UsersRound className="h-6 w-6" />
            </div>
            <p className="text-lg font-bold text-primary">You&apos;re in solo mode</p>
            <p className="text-sm text-black/50 mt-2 leading-relaxed">
              Job seekers in a pod apply 2.4× more consistently. Get matched with 6 other Product Designers at your level, in
              your timezone, going through the same thing right now.
            </p>
            <StickerButton variant="primary" size="lg" className="mt-6" onClick={() => setPodOn(true)}>
              Join a pod
            </StickerButton>
          </DashCard>
        ) : (
          // -----------------------------------------------------------------
          // Active pod
          // -----------------------------------------------------------------
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
            {/* Left column */}
            <div className="flex flex-col gap-5 min-w-0">
              {/* Dark hero — also owns goal creation/removal/voting, collapsed by default */}
              <div className="relative overflow-hidden rounded-[18px] bg-primary text-white p-7">
                <div aria-hidden className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-secondary/25 blur-3xl pointer-events-none" />
                <div className="relative">
                  <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-secondary mb-4">
                    Product Designers · 3–5 yrs · Remote
                  </p>

                  <div className="flex items-center mb-5">
                    <div className="flex items-center -space-x-2">
                      {BOARD.map((row) => (
                        <div
                          key={row.rank}
                          className="h-8 w-8 rounded-full ring-2 ring-primary bg-white/15 text-white text-[11px] font-bold flex items-center justify-center">
                          {initials(row.name)}
                        </div>
                      ))}
                    </div>
                    <span className="text-sm text-white/55 ml-3">{BOARD.length} people</span>
                  </div>

                  <p className="text-2xl font-bold leading-snug mb-5 max-w-md">
                    Your pod is going for {podGoalTarget} applications today — {podGoalCurrent} are in.
                  </p>

                  <ProgressBar value={podPct} dark height="h-[9px]" className="mb-3" />
                  <p className="text-sm text-white/55">You&apos;ve sent {mySentToday} of them.</p>

                  {/* Goal management lives here, not a separate card — collapsed until asked for */}
                  <div className="mt-6 pt-5 border-t border-white/15">
                    <button
                      type="button"
                      onClick={() => setGoalsPanelOpen((v) => !v)}
                      aria-expanded={goalsPanelOpen}
                      className="w-full flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-sm font-bold text-white">Manage pod goals</span>
                      <span className="inline-flex items-center gap-2">
                        {votingGoals.length > 0 && (
                          <Pill variant="positive">{votingGoals.length} up for a vote</Pill>
                        )}
                        <ChevronDown className={cn("h-4 w-4 text-white/50 transition-transform", goalsPanelOpen && "rotate-180")} />
                      </span>
                    </button>

                    {goalsPanelOpen && (
                      <div className="mt-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-white/50">What the whole pod is working toward, together.</p>
                          <StickerButton variant="secondary" size="sm" shadowColor="#ffffff" onClick={() => setSuggestOpen(true)}>
                            <Plus className="h-3.5 w-3.5" />
                            Suggest a goal
                          </StickerButton>
                        </div>

                        <div className="flex flex-col gap-3">
                          {activeGoals.map((goal) => {
                            const pct = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;
                            const isDailyGoal = goal.id === DAILY_GOAL_ID;
                            const goalDone = goal.current >= goal.target;
                            return (
                              <div key={goal.id} className="rounded-lg border border-white/20 bg-white/8 p-4">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="min-w-0 flex items-center gap-2">
                                    {goal.protected && <Lock className="h-3.5 w-3.5 text-white/50 flex-none" aria-label="Protected goal" />}
                                    <p className="text-sm font-bold text-white truncate">{goal.label}</p>
                                  </div>
                                  {!goal.protected && (
                                    <button
                                      type="button"
                                      onClick={() => suggestRemoval(goal.id)}
                                      className="flex-none text-[11px] font-semibold text-white/50 hover:text-white underline decoration-dotted underline-offset-2 cursor-pointer">
                                      Suggest removing
                                    </button>
                                  )}
                                </div>
                                <ProgressBar value={pct} dark className="mb-2" />
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs text-white/55">
                                    {goal.current} of {goal.target} {goal.unit}
                                  </p>
                                  {isDailyGoal && (
                                    <StickerButton
                                      variant="secondary"
                                      size="sm"
                                      shadowColor="#ffffff"
                                      onClick={logApplication}
                                      disabled={goalDone}>
                                      <Plus className="h-3 w-3" />
                                      Log one
                                    </StickerButton>
                                  )}
                                </div>
                                {isDailyGoal && (
                                  <p className="text-[11px] text-white/40 mt-2 pt-2 border-t border-white/10">
                                    Also counts toward your own weekly goal: {myWeeklyApps} of {WEEKLY_GOAL.target} applications.
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {votingGoals.length > 0 && (
                          <div className="mt-2 pt-4 border-t border-white/15">
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/45 mb-3">Up for a vote</p>
                            <div className="flex flex-col gap-3">
                              {votingGoals.map((goal) => {
                                const pct = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;
                                const forCount = goal.votes.filter((v) => v.choice === "for").length;
                                const againstCount = goal.votes.filter((v) => v.choice === "against").length;
                                const myVote = goal.votes.find((v) => v.memberName === "You");
                                const trendingAgainst = againstCount > forCount;
                                return (
                                  <div key={goal.id} className="rounded-lg border border-dashed border-white/30 bg-white/8 p-4">
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/45">
                                        {goal.status === "voting-add" ? "New goal proposed" : "Proposed removal"} · {goal.proposedBy ?? "You"}
                                      </p>
                                      <Pill
                                        variant={goal.status === "voting-add" ? "positive" : "urgent"}
                                        className={goal.status !== "voting-add" ? "bg-white/15 text-secondary" : undefined}>
                                        {goal.status === "voting-add" ? "Add" : "Remove"}
                                      </Pill>
                                    </div>
                                    <p className="text-sm font-bold text-white mb-2">{goal.label}</p>
                                    <ProgressBar value={pct} dark className="mb-1.5" />
                                    <p className="text-xs text-white/55 mb-3">
                                      {goal.current} of {goal.target} {goal.unit}
                                    </p>
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <p className="text-xs text-white/45">
                                        {forCount} for · {againstCount} against · closes in {goal.daysLeft}d
                                        {trendingAgainst && !myVote ? " · trending against" : ""}
                                      </p>
                                      {myVote ? (
                                        <Pill variant="neutral" className="bg-white/15 text-white">
                                          You voted {myVote.choice === "for" ? "for" : "against"}
                                        </Pill>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <StickerButton
                                            variant="secondary"
                                            size="sm"
                                            shadowColor="#ffffff"
                                            onClick={() => castVote(goal.id, "for")}>
                                            Vote for
                                          </StickerButton>
                                          <StickerButton
                                            variant="outline"
                                            size="sm"
                                            shadowColor="#ffffff"
                                            onClick={() => castVote(goal.id, "against")}>
                                            Vote against
                                          </StickerButton>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* What's moving */}
              <DashCard className="p-6">
                <p className="text-[15px] font-bold text-primary mb-1">What&apos;s moving</p>
                <p className="text-xs text-black/45 mb-4">Live updates from your pod.</p>
                <div className="flex flex-col gap-2.5">
                  {FEED.map((item) => {
                    const state = feedState[item.id];
                    return (
                      <div key={item.id} className="flex items-start gap-3 rounded-lg border border-black/10 bg-[#fbfbf7] p-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-primary">{item.text}</p>
                            {item.hot && <Pill variant="urgent">Hot</Pill>}
                          </div>
                          <p className="text-xs text-black/40 mt-0.5">{item.time}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-none">
                          <button
                            type="button"
                            onClick={() => toggleFire(item.id)}
                            aria-pressed={state.fired}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                              state.fired ? "bg-secondary border-secondary text-primary" : "border-black/10 text-black/50 hover:border-black/25"
                            )}>
                            <Flame className="h-3.5 w-3.5" />
                            {state.count}
                          </button>
                          <button
                            type="button"
                            onClick={() => sendCongrats(item.id)}
                            disabled={state.congratsSent}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                              state.congratsSent
                                ? "bg-[#f0f0ea] text-black/40 cursor-default"
                                : "bg-primary text-white hover:opacity-90 cursor-pointer"
                            )}>
                            {state.congratsSent ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Sent
                              </>
                            ) : (
                              "Nice one!"
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DashCard>
            </div>

            {/* Right rail */}
            <div className="flex flex-col gap-5 min-w-0">
              {/* Pod streak — the shared one. A pod day counts when 60% of
                  members log, so one person's bad day can't cost six other
                  people their streak, and nobody is carrying the whole thing. */}
              <DashCard className="p-6">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-[15px] font-bold text-primary">Pod streak</p>
                  <Pill variant={podLoggedToday ? "positive" : "neutral"}>
                    {podLoggedToday ? "Today counts" : `${loggedNames.length} of ${quorum} needed`}
                  </Pill>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[32px] font-extrabold leading-none text-primary tabular-nums">{podStreakDays}</span>
                  <span className="text-sm text-black/45">days together</span>
                </div>
                <p className="text-xs text-black/45 mb-3">
                  {podLoggedToday
                    ? "Quorum reached — today counts for everyone."
                    : `${quorum - loggedNames.length} more ${quorum - loggedNames.length === 1 ? "person" : "people"} keeps it alive.`}
                </p>
                <ProgressBar value={Math.min(100, Math.round((loggedNames.length / quorum) * 100))} className="mb-4" />

                <div className="flex flex-col gap-1">
                  {BOARD.map((row) => {
                    const done = loggedNames.includes(row.name);
                    const alreadyNudged = nudged.includes(row.name);
                    return (
                      <div key={row.rank} className="flex items-center gap-2.5 py-1">
                        <span
                          className={cn(
                            "h-6 w-6 flex-none rounded-full text-[10px] font-bold flex items-center justify-center",
                            done ? "bg-secondary text-primary" : "bg-[#f0f0ea] text-black/40"
                          )}>
                          {initials(row.name)}
                        </span>
                        <span className={cn("min-w-0 flex-1 truncate text-sm", done ? "text-primary font-medium" : "text-black/50")}>
                          {row.name}
                        </span>
                        {done ? (
                          <Check className="h-3.5 w-3.5 flex-none text-primary" />
                        ) : row.me ? (
                          <StickerButton variant="secondary" size="sm" onClick={openLog}>
                            Log
                          </StickerButton>
                        ) : (
                          <button
                            type="button"
                            onClick={() => nudge(row.name)}
                            disabled={alreadyNudged}
                            className="flex-none rounded-full border border-black/15 px-2.5 py-1 text-[11px] font-semibold text-black/55 transition-colors hover:border-[#222325] hover:text-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-black/15">
                            {alreadyNudged ? "Nudged" : "Nudge"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </DashCard>

              {/* Leaderboard */}
              <DashCard className="p-6">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-[15px] font-bold text-primary">This week</p>
                  <span
                    title={`Your current streak: ${myStreak} days`}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary border-[1.5px] border-[#222325] px-2 py-1 text-[11px] font-bold text-primary shadow-[2px_2px_0_0_#222325]">
                    <StreakFlame tier={myTier} size={12} pulse={logPulse} dimmed={myStreak === 0} />
                    {myStreak}d
                  </span>
                </div>
                <p className="text-xs text-black/45 mb-3">Streaks and applications logged since Monday.</p>
                <div className="flex flex-col">
                  {BOARD.map((row) => {
                    const isOpen = openBoardRow === row.rank;
                    return (
                      <div key={row.rank} className="border-b border-black/8 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => !row.me && toggleBoardRow(row.rank)}
                          className={cn(
                            "w-full flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg text-left transition-colors",
                            row.me ? "bg-secondary/70 border-2 border-[#222325]" : "border-2 border-transparent hover:bg-[#f6f6f6] cursor-pointer"
                          )}>
                          <span className="h-5 w-5 flex-none rounded-full bg-white text-[11px] font-bold text-primary flex items-center justify-center border border-black/10">
                            {row.rank}
                          </span>
                          <span className="h-7 w-7 flex-none rounded-full bg-[#222325] text-white text-[10px] font-bold flex items-center justify-center">
                            {initials(row.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-primary truncate">{row.name}</span>
                            <span className="flex items-center gap-1 text-[11px] text-black/45">
                              {/* Your own row reads the live streak so the pod board and the
                                  Home header can never disagree about your number. */}
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
                          <div className="pl-11 pb-3 -mt-0.5">
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
                <p className="text-[15px] font-bold text-primary mb-1">Pod settings</p>
                <p className="text-xs text-black/45 mb-4 leading-relaxed">
                  Matched by role, experience band and timezone — Product Designers, 3–5 yrs, GMT±2.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setMuted((v) => !v)}
                    className="flex items-center justify-between gap-2 rounded-lg border-[1.5px] border-black/12 px-3.5 py-2.5 text-sm font-semibold text-primary hover:border-[#222325] hover:bg-[#f6f6f6] transition-colors cursor-pointer">
                    <span className="inline-flex items-center gap-2">
                      {muted ? <BellOff className="h-3.5 w-3.5 text-black/45" /> : <Bell className="h-3.5 w-3.5 text-black/45" />}
                      {muted ? "Unmute pod notifications" : "Mute pod notifications"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRerolled(true)}
                    disabled={rerolled}
                    className="flex items-center justify-between gap-2 rounded-lg border-[1.5px] border-black/12 px-3.5 py-2.5 text-sm font-semibold text-primary hover:border-[#222325] hover:bg-[#f6f6f6] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-black/12 disabled:hover:bg-transparent">
                    <span className="inline-flex items-center gap-2">
                      <Shuffle className="h-3.5 w-3.5 text-black/45" />
                      {rerolled ? "Rerolled this week" : "Reroll my pod"}
                    </span>
                    {!rerolled && <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-black/35">1× / week</span>}
                  </button>
                  {/* Pausing is a first-class action, not a hidden setting —
                      taking a break is normal and the UI should say so. */}
                  <button
                    type="button"
                    onClick={() => (userGoals.paused ? resumeSearch() : setPauseOpen(true))}
                    className="flex items-center justify-between gap-2 rounded-lg border-[1.5px] border-black/12 px-3.5 py-2.5 text-sm font-semibold text-primary hover:border-[#222325] hover:bg-[#f6f6f6] transition-colors cursor-pointer">
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
                    className="flex items-center justify-between gap-2 rounded-lg border-[1.5px] border-black/12 px-3.5 py-2.5 text-sm font-semibold text-primary hover:border-[#222325] hover:bg-[#f6f6f6] transition-colors cursor-pointer">
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
      <RewardModal
        open={rewardOpen}
        onOpenChange={setRewardOpen}
        amount={2}
        title="Three wins shared"
        body="You've shared 3 wins with your network this month — your pod sees it too."
        balance={40}
      />
      <SuggestGoalDialog open={suggestOpen} onOpenChange={setSuggestOpen} onSuggest={handleSuggestGoal} />
      <PauseSearchDialog open={pauseOpen} onOpenChange={setPauseOpen} />
    </div>
  );
};

export default PodClient;
