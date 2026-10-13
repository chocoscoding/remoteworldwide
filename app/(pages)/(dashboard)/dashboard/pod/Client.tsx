"use client";

// The live pod. Everything here comes from /api/pod/overview — no mock data.
//
// It shows what a real pod actually has: panels that would be empty for a new
// pod say so rather than being filled with plausible numbers.
//
// Laid out after the owner's 2026-10-13 mockup ("pods new"): one header with the pod's chip, its
// faces and the one action (Log today), everything else behind "⋯"; a dark strip for today; then
// Goals and What's moving beside This week, as compact hairline rows.

import { FC, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUp,
  Bell,
  BellOff,
  CircleAlert,
  Copy,
  Ellipsis,
  Flame,
  Lock,
  LogOut,
  Plus,
  SlidersHorizontal,
  Trophy,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SuggestGoalDialog, { type SuggestedGoalInput } from "@/app/components/dashboard/modals/SuggestGoalDialog";
import ShareWinModal from "@/app/components/dashboard/modals/ShareWinModal";
import ManageGoalsDialog from "@/app/components/dashboard/pod/ManageGoalsDialog";
import InvitePodDialog from "@/app/components/dashboard/pod/InvitePodDialog";
import JoinPodDialog from "@/app/components/dashboard/pod/JoinPodDialog";
import CreatePodDialog from "@/app/components/dashboard/pod/CreatePodDialog";
import LeavePodDialog from "@/app/components/dashboard/pod/LeavePodDialog";
import AboutPodDialog from "@/app/components/dashboard/pod/AboutPodDialog";
import PodAvatar from "@/app/components/dashboard/pod/PodAvatar";
import PodEmptyState from "@/app/components/dashboard/pod/PodEmptyState";
import { useLivePod } from "@/app/components/dashboard/pod/LivePodProvider";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { GOAL_KIND_META } from "@/app/components/dashboard/pod/pod-goal-meta";
import { JOIN_PARAM, JOIN_REFUSAL } from "@/app/lib/dashboard/pod-invite";
import { awaitingMyVote, GOAL_LINK_PARAM, isStandingGoal } from "@/app/lib/pod/goalVotes";

/** Faces shown in the header before the rest fold into "+N". */
const STACK_LIMIT = 5;

const CARD = "overflow-hidden rounded-[14px] border border-black/15 bg-white";
const ROW = "flex min-h-[52px] items-center gap-3 border-t border-black/10 px-4 py-2";
const MENU_ITEM =
  "flex h-[38px] w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-bold text-[#222325] transition-colors hover:bg-[#f0f0ea] disabled:cursor-default disabled:opacity-50";

const PodClient: FC = () => {
  const {
    overview,
    members,
    inPod,
    capacity,
    seatsLeft,
    goals,
    busy,
    matching,
    muted,
    joinByMatching,
    joinWithCode,
    shareToPod,
    toggleFire,
    toggleMute,
    suggestGoal,
    logDay,
  } = useLivePod();
  const { loggedToday, openLog } = useActivity();

  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduceMotion = useReducedMotion();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [shareWinOpen, setShareWinOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const pod = overview.pod;
  // A goal under review is still the pod's (owner, 2026-10-13): it stays here until the review carries.
  const activeGoals = useMemo(() => goals.filter(isStandingGoal), [goals]);
  /** Open votes you haven't cast: the badge on Manage. */
  const awaiting = useMemo(() => awaitingMyVote(goals), [goals]);

  /**
   * An invite link lands here as `?join=<code>`. Consumed once and stripped, so
   * a refresh doesn't re-run the join and a link left open in a tab can't fire
   * again later. The server is idempotent about it too; this only stops the UI
   * from asking twice.
   */
  const consumed = useRef(false);
  const joinParam = params.get(JOIN_PARAM);
  useEffect(() => {
    if (!joinParam || consumed.current) return;
    consumed.current = true;
    router.replace(pathname);

    void (async () => {
      const result = await joinWithCode(joinParam);
      if (result === "joined") return;
      toast.error("That invite didn't work", {
        description: JOIN_REFUSAL[result],
        action: { label: "Try another", onClick: () => setJoinOpen(true) },
      });
    })();
  }, [joinParam, joinWithCode, pathname, router]);

  /**
   * A "goal under review" notification lands here as `?goal=<id>`, which opens the goals dialog on
   * that goal. Read from the address rather than copied into state, so clicking the same
   * notification again opens it again; closing the dialog takes the parameter off.
   */
  const focusGoalId = inPod ? params.get(GOAL_LINK_PARAM) : null;
  const goalsOpen = manageOpen || focusGoalId !== null;

  function closeGoals() {
    setManageOpen(false);
    if (focusGoalId !== null) router.replace(pathname, { scroll: false });
  }

  function share() {
    const text = draft.trim();
    if (!text) return;
    shareToPod(text);
    setDraft("");
  }

  function handleSuggest(input: SuggestedGoalInput) {
    suggestGoal(input);
    setSuggestOpen(false);
  }

  /** The board moves from what was really done: with something logged today this syncs it to the pod; with nothing yet it opens the log. */
  function logToday() {
    if (loggedToday) logDay(1);
    else openLog();
  }

  async function copyCode() {
    if (!pod) return;
    try {
      await navigator.clipboard.writeText(pod.inviteCode);
      toast.success("Invite code copied", { description: "Anyone with it can join while there's a seat." });
    } catch {
      setInviteOpen(true);
    }
  }

  /** Picks a menu item: the menu closes first, so the dialog it opens takes the focus. */
  const fromMenu = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  const stacked = members.slice(0, STACK_LIMIT);
  const moreFaces = members.length - stacked.length;

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[13px] text-[#222325]">
      <header className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center gap-3 border-b border-black/10 bg-white/90 px-4 py-2.5 backdrop-blur-sm md:px-8">
        <h1 className="whitespace-nowrap text-[17px] font-extrabold">Your pod</h1>
        {pod && (
          <button
            type="button"
            onClick={copyCode}
            aria-label={`Copy the invite code for ${pod.name}`}
            title="Copy the invite code"
            className="flex h-7 max-w-[180px] cursor-pointer items-center gap-1.5 rounded-full bg-[#f0f0ea] px-2.5 text-xs font-bold text-[#44453f] transition-colors hover:bg-[#e6e6de]">
            <span className="truncate">{pod.name}</span>
            <Copy className="h-3 w-3 flex-none" />
          </button>
        )}
        <div className="flex-1" />

        {/* Every action here acts on a pod, so out of one the bar holds only the bell. */}
        {inPod && pod && (
          <>
            <div className="hidden items-center sm:flex">
              {stacked.map((member, i) => (
                <span key={member.userId} title={member.name} className={cn("rounded-full border-2 border-white", i > 0 && "-ml-2")}>
                  <PodAvatar name={member.name} image={member.image} size={28} />
                </span>
              ))}
              {moreFaces > 0 && (
                <span className="-ml-2 grid h-8 w-8 place-content-center rounded-full border-2 border-white bg-[#f0f0ea] text-[11px] font-extrabold">
                  +{moreFaces}
                </span>
              )}
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                disabled={seatsLeft === 0}
                aria-label="Invite to pod"
                title={seatsLeft === 0 ? "This pod is full" : `${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left`}
                className="-ml-2 grid h-8 w-8 cursor-pointer place-content-center rounded-full border-[1.5px] border-dashed border-[#222325] bg-white transition-colors hover:bg-[#f4f9c9] disabled:cursor-default disabled:opacity-40">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </div>

            <button
              type="button"
              onClick={logToday}
              disabled={busy}
              title={loggedToday ? "Show the pod what you did today" : "Log an application. The pod sees it on its own"}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-[9px] bg-[#e1f073] px-4 text-[13px] font-extrabold br-shadow-press disabled:opacity-50">
              <Flame className="h-[15px] w-[15px]" strokeWidth={2.2} />
              Log today
            </button>

            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Pod options"
                  className="grid h-10 w-10 cursor-pointer place-content-center rounded-full border-[1.5px] border-[#222325] bg-[#f0f0ea] transition-colors hover:bg-[#e6e6de]">
                  <Ellipsis className="h-[17px] w-[17px]" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="flex w-[220px] flex-col rounded-xl bg-white p-1.5 br-shadow">
                {/* Invite lives in the faces above from sm up; on a phone it is here. */}
                <button type="button" onClick={fromMenu(() => setInviteOpen(true))} disabled={seatsLeft === 0} className={cn(MENU_ITEM, "sm:hidden")}>
                  <Plus className="h-[15px] w-[15px]" />
                  Invite
                </button>
                <button type="button" onClick={fromMenu(() => setSuggestOpen(true))} className={MENU_ITEM}>
                  <Plus className="h-[15px] w-[15px]" />
                  Suggest a goal
                </button>
                <button type="button" onClick={fromMenu(toggleMute)} disabled={busy} aria-pressed={muted} className={MENU_ITEM}>
                  {muted ? <Bell className="h-[15px] w-[15px]" /> : <BellOff className="h-[15px] w-[15px]" />}
                  {muted ? "Unmute pod" : "Mute pod"}
                </button>
                <button type="button" onClick={fromMenu(() => setAboutOpen(true))} className={MENU_ITEM}>
                  <CircleAlert className="h-[15px] w-[15px]" />
                  About this pod
                </button>
                <div className="mx-1.5 my-1 h-px bg-black/15" />
                {/* Never the plain action: for the last member out this deletes the pod, and the
                    dialog is where that gets said before it happens. */}
                <button type="button" onClick={fromMenu(() => setLeaveOpen(true))} disabled={busy} className={cn(MENU_ITEM, "text-[#b23c26] hover:bg-[#fdf3f1]")}>
                  <LogOut className="h-[15px] w-[15px]" />
                  {pod.soleMember ? "Delete pod" : "Leave pod"}
                </button>
              </PopoverContent>
            </Popover>
          </>
        )}
        <NotificationBell />
      </header>

      <main className="mx-auto flex max-w-[1120px] flex-col gap-4 px-4 pb-12 pt-6 md:px-8">
        {!inPod || !pod ? (
          <PodEmptyState
            capacity={capacity}
            matching={matching}
            onMatch={joinByMatching}
            onCreate={() => setCreateOpen(true)}
            onJoinWithCode={() => setJoinOpen(true)}
          />
        ) : (
          <>
            {/* Today, at a glance: who has logged, what keeps the streak, and the streak. */}
            <section aria-label="Today" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[14px] bg-[#222325] px-5 py-3.5 text-white">
              <span className="flex-none rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em]">{pod.weekLabel}</span>
              <div className="flex min-w-0 flex-[999_1_280px] items-center gap-3">
                <div role="img" aria-label={`${pod.loggedTodayCount} of ${pod.memberCount} logged today`} className="flex gap-1">
                  {Array.from({ length: pod.memberCount }, (_, i) => (
                    <span key={i} className={cn("h-2 w-[22px] rounded", i < pod.loggedTodayCount ? "bg-[#e1f073]" : "bg-white/20")} />
                  ))}
                </div>
                <span className="text-sm font-bold">
                  {pod.loggedTodayCount} of {pod.memberCount} logged today{" "}
                  <span className="font-medium text-white/75">· {pod.quorum} keep the streak</span>
                </span>
              </div>
              <span className="flex flex-none items-center gap-1.5 text-sm font-extrabold">
                <Flame className="h-4 w-4 text-[#e1f073]" strokeWidth={2.2} />
                {pod.streakDays}-day streak
              </span>
            </section>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-w-0 flex-col gap-4">
                <section aria-label="Pod goals" className={CARD}>
                  <div className="flex items-center gap-2.5 py-3 pl-4 pr-3">
                    <h2 className="flex-1 text-sm font-extrabold">Goals</h2>
                    <button
                      type="button"
                      onClick={() => setManageOpen(true)}
                      aria-label={awaiting > 0 ? `Manage goals, ${awaiting} ${awaiting === 1 ? "vote" : "votes"} waiting on you` : "Manage goals"}
                      className="flex h-[34px] cursor-pointer items-center gap-2 rounded-[9px] bg-white pl-3 pr-2 text-[13px] font-extrabold br-shadow-press br-lime">
                      <SlidersHorizontal className="h-[15px] w-[15px]" />
                      Manage
                      {awaiting > 0 ? (
                        <span className="grid h-5 min-w-5 place-content-center rounded-full bg-[#b23c26] px-1.5 text-[11px] font-extrabold tabular-nums text-white">
                          {awaiting}
                        </span>
                      ) : (
                        <span className="w-1" />
                      )}
                    </button>
                  </div>

                  {activeGoals.length === 0 ? (
                    <div className="border-t border-black/10 px-4 py-2">
                      <DashEmptyState
                        bare
                        icon={Trophy}
                        title="No goals yet"
                        body="Suggest one and the pod votes on it. A majority makes it live."
                        ctaLabel="Suggest a goal"
                        onCta={() => setSuggestOpen(true)}
                      />
                    </div>
                  ) : (
                    activeGoals.map((goal) => {
                      const meta = GOAL_KIND_META[goal.kind];
                      const Icon = meta.icon;
                      const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
                      return (
                        <div key={goal.id} data-goal={goal.id} className={ROW}>
                          <span className={cn("grid h-[30px] w-[30px] flex-none place-content-center rounded-lg", goal.protected ? "bg-[#f0f0ea]" : "bg-[#e1f073]")}>
                            <Icon className="h-[15px] w-[15px]" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold">
                              <span className="truncate">{goal.label}</span>
                              {goal.protected && <Lock aria-label="Default goal, can't be removed" className="h-3 w-3 flex-none text-[#5f6062]" strokeWidth={2.2} />}
                              {goal.status === "voting-remove" && <span className="flex-none text-xs font-semibold text-[#b23c26]">in review</span>}
                              {meta.href && meta.linkLabel && (
                                <Link href={meta.href} className="flex-none text-xs font-semibold text-[#5f6062] underline underline-offset-2 hover:text-[#222325]">
                                  {meta.linkLabel}
                                </Link>
                              )}
                            </span>
                            <span role="img" aria-label={`${goal.current} of ${goal.target}`} className="h-1.5 rounded-[3px] bg-[#ecece6]">
                              <span className="block h-1.5 rounded-[3px] bg-[#cddd54]" style={{ width: `${pct}%` }} />
                            </span>
                          </span>
                          <span className="w-10 flex-none text-right text-[13px] font-extrabold tabular-nums">
                            {goal.current}
                            <span className="font-semibold text-[#9a9b95]">/{goal.target}</span>
                          </span>
                        </div>
                      );
                    })
                  )}
                </section>

                <section aria-label="What's moving" className={CARD}>
                  <div className="m-3 flex items-center gap-2 rounded-[10px] border border-black/30 bg-[#fbfbf7] py-1 pl-3 pr-1 focus-within:border-[#222325]">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && share()}
                      placeholder="Tell the pod what moved today…"
                      aria-label="Share an update with your pod"
                      className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/40"
                    />
                    {/* An interview or offer off the tracker, to this pod and beyond. */}
                    <button
                      type="button"
                      onClick={() => setShareWinOpen(true)}
                      aria-label="Share a win"
                      title="Share a win from your tracker"
                      className="grid h-9 w-9 flex-none cursor-pointer place-content-center rounded-lg transition-colors hover:bg-[#f0f0ea]">
                      <Trophy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={share}
                      disabled={busy || !draft.trim()}
                      aria-label="Post"
                      className="grid h-9 w-9 flex-none cursor-pointer place-content-center rounded-lg bg-[#222325] text-white transition-opacity disabled:cursor-default disabled:opacity-40">
                      <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                  </div>

                  {overview.moving.length === 0 ? (
                    <div className="border-t border-black/10 px-4 py-2">
                      <DashEmptyState bare icon={UsersRound} title="Nothing yet" body="Be the first to say what you're working on today." />
                    </div>
                  ) : (
                    // A new post arriving is the whole reason to look at this panel, so it slides in
                    // rather than appearing between two renders. `layout` keeps the rows below it
                    // from jumping as it does.
                    <AnimatePresence initial={false}>
                      {overview.moving.map((item) => {
                        const author = item.author ?? { name: item.mine ? "You" : "Someone", image: null };
                        return (
                          <motion.div
                            key={item.id}
                            data-post={item.id}
                            layout={!reduceMotion}
                            initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0 }}
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            className={cn(ROW, item.hot && "bg-[#f8fbe8]")}>
                            <PodAvatar name={author.name} image={author.image} size={30} />
                            <span className="min-w-0 flex-1 text-[13px]">
                              <strong className="font-extrabold">{author.name}</strong> {item.text}
                            </span>
                            <span className="flex-none text-xs text-[#5f6062]">{item.time}</span>
                            {/* The mutation is already optimistic, so the punch lands on the same frame as the count. */}
                            <motion.button
                              type="button"
                              onClick={() => toggleFire(item.id)}
                              aria-pressed={item.firedByMe}
                              aria-label={item.firedByMe ? `Take back your cheer, ${item.fires} so far` : `Cheer, ${item.fires} so far`}
                              whileTap={reduceMotion ? undefined : { scale: 0.88 }}
                              transition={{ type: "spring", stiffness: 620, damping: 18 }}
                              className={cn(
                                "flex h-7 flex-none cursor-pointer items-center gap-1 rounded-full border px-2.5 text-xs font-bold transition-colors",
                                item.firedByMe ? "border-[#222325] bg-[#e1f073]" : "border-black/30 bg-white hover:border-[#222325]",
                              )}>
                              <Flame className="h-[13px] w-[13px]" strokeWidth={2.2} />
                              <span className="tabular-nums">{item.fires}</span>
                            </motion.button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </section>
              </div>

              <aside aria-label="This week" className={CARD}>
                <div className="flex items-baseline justify-between gap-2.5 px-4 py-3">
                  <h2 className="text-sm font-extrabold">This week</h2>
                  <span className="text-xs text-[#5f6062]">applications</span>
                </div>
                <ol className="flex flex-col gap-0.5 px-2 pb-2">
                  {members.map((member) => (
                    <li
                      key={member.userId}
                      data-member={member.userId}
                      className={cn("flex min-h-11 items-center gap-2.5 rounded-lg px-2", member.me && "bg-[#f4f9c9]")}>
                      <span className="w-3.5 flex-none text-xs font-extrabold text-[#5f6062]">{member.rank}</span>
                      <PodAvatar name={member.name} image={member.image} size={28} />
                      <span className={cn("min-w-0 flex-1 truncate text-[13px]", member.me ? "font-extrabold" : "font-bold")}>{member.name}</span>
                      {member.loggedToday ? (
                        <span title="Logged today" className="h-2 w-2 flex-none rounded-full bg-[#cddd54]" />
                      ) : (
                        member.me && (
                          <button
                            type="button"
                            onClick={openLog}
                            className="flex-none cursor-pointer text-xs font-extrabold underline underline-offset-2">
                            Log
                          </button>
                        )
                      )}
                      <span className="flex-none text-[13px] font-extrabold tabular-nums">{member.apps}</span>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </>
        )}
      </main>

      <InvitePodDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <JoinPodDialog open={joinOpen} onOpenChange={setJoinOpen} />
      <CreatePodDialog open={createOpen} onOpenChange={setCreateOpen} />
      <LeavePodDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
      <AboutPodDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      {goalsOpen && (
        <ManageGoalsDialog key={focusGoalId ?? "manage"} focusGoalId={focusGoalId} onClose={closeGoals} onSuggest={() => setSuggestOpen(true)} />
      )}
      <SuggestGoalDialog open={suggestOpen} onOpenChange={setSuggestOpen} onSuggest={handleSuggest} />
      <ShareWinModal open={shareWinOpen} onOpenChange={setShareWinOpen} />
    </div>
  );
};

export default PodClient;
