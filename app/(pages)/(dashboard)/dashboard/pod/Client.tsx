"use client";

// The live pod. Everything here comes from /api/pod/overview — no mock data.
//
// It renders less than /dashboard/pod/demo does, and that is the point: the
// demo is a fully-populated walkthrough, this shows what a real pod actually
// has. Panels that would be empty for a new pod say so rather than being
// filled with plausible numbers.

import { FC, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Bell, BellOff, Flame, LogOut, Send, Settings2, Trophy, UserPlus, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import SuggestGoalDialog, { type SuggestedGoalInput } from "@/app/components/dashboard/modals/SuggestGoalDialog";
import ManageGoalsDialog from "@/app/components/dashboard/pod/ManageGoalsDialog";
import InvitePodDialog from "@/app/components/dashboard/pod/InvitePodDialog";
import JoinPodDialog from "@/app/components/dashboard/pod/JoinPodDialog";
import CreatePodDialog from "@/app/components/dashboard/pod/CreatePodDialog";
import LeavePodDialog from "@/app/components/dashboard/pod/LeavePodDialog";
import PodEmptyState from "@/app/components/dashboard/pod/PodEmptyState";
import { useLivePod } from "@/app/components/dashboard/pod/LivePodProvider";
import { GOAL_KIND_META } from "@/app/components/dashboard/pod/pod-goal-meta";
import { JOIN_PARAM, JOIN_REFUSAL } from "@/app/lib/dashboard/pod-invite";
import type { PodMember } from "@/app/lib/pod/types";

const initialsOf = (name: string) =>
  name === "You"
    ? "ME"
    : name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

const Face: FC<{ member: PodMember }> = ({ member }) =>
  member.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={member.image} alt="" className="h-full w-full object-cover" />
  ) : (
    <>{initialsOf(member.name)}</>
  );

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
    isOwner,
    joinByMatching,
    joinWithCode,
    shareToPod,
    toggleFire,
    toggleMute,
    renamePod,
    suggestGoal,
    logDay,
  } = useLivePod();

  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduceMotion = useReducedMotion();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [draft, setDraft] = useState("");
  /** Null unless the owner is editing the name; holds the in-progress text. */
  const [nameDraft, setNameDraft] = useState<string | null>(null);

  const pod = overview.pod;
  const activeGoals = useMemo(() => goals.filter((g) => g.status === "active"), [goals]);
  const votingCount = goals.length - activeGoals.length;

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

  /** Commits a rename, or quietly abandons it when nothing changed. */
  function commitName() {
    const next = nameDraft?.trim();
    setNameDraft(null);
    if (next && next !== pod?.name) renamePod(next);
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="whitespace-nowrap text-[17px] font-bold text-primary">Your pod</h1>
          {/* The pod's own name, where the matching blurb used to be. `criteria` still explains how
              you got here, but it belongs in Pod settings — this is the pod's identity. */}
          {pod &&
            (nameDraft !== null ? (
              <input
                autoFocus
                value={nameDraft}
                maxLength={40}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") setNameDraft(null);
                }}
                aria-label="Pod name"
                className="min-w-0 max-w-[220px] rounded-md border-[1.5px] border-[#222325] bg-white px-2 py-0.5 text-sm font-semibold text-primary outline-none"
              />
            ) : isOwner ? (
              <button
                type="button"
                onClick={() => setNameDraft(pod.name)}
                title="Rename this pod"
                className="truncate rounded-md px-1.5 py-0.5 text-sm font-semibold text-black/55 transition-colors hover:bg-[#f0f0ea] hover:text-primary cursor-pointer">
                {pod.name}
              </button>
            ) : (
              <span className="truncate text-sm font-semibold text-black/45">{pod.name}</span>
            ))}
        </div>
        {/* Every action here acts on a pod, so out of one the bar is empty
            rather than offering things that would have nowhere to land. */}
        {inPod && (
          <div className="flex flex-none items-center gap-3">
            <StickerButton
              variant="outline"
              size="md"
              onClick={() => setInviteOpen(true)}
              disabled={seatsLeft === 0}
              title={seatsLeft === 0 ? "This pod is full" : `${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left`}>
              <UserPlus className="h-4 w-4" />
              Invite
            </StickerButton>
            <StickerButton
              variant="outline"
              size="md"
              onClick={toggleMute}
              disabled={busy}
              title={muted ? "You'll still hear about your own membership" : "Silence this pod's activity"}>
              {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {muted ? "Muted" : "Mute"}
            </StickerButton>
            <StickerButton variant="primary" size="md" onClick={() => logDay(1)} disabled={busy}>
              <Flame className="h-4 w-4" />
              Log today
            </StickerButton>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1180px] px-8 py-7 pb-14">
        {!inPod || !pod ? (
          <PodEmptyState
            capacity={capacity}
            matching={matching}
            onMatch={joinByMatching}
            onCreate={() => setCreateOpen(true)}
            onJoinWithCode={() => setJoinOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_360px]">
            <div className="flex min-w-0 flex-col gap-5">
              <DashCard className="bg-[#222325] p-6 text-white">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-white/45">{pod.weekLabel}</p>
                    <p className="mt-1 text-2xl font-bold">
                      {pod.memberCount} {pod.memberCount === 1 ? "person" : "people"}, one week
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      {pod.loggedTodayCount} of {pod.memberCount} logged today · quorum is {pod.quorum}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[32px] font-extrabold leading-none tabular-nums">{pod.streakDays}</p>
                    <p className="text-xs text-white/55">day pod streak</p>
                  </div>
                </div>
              </DashCard>

              <DashCard className="p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-bold text-primary">Today&apos;s goals</p>
                    <p className="text-xs text-black/60">What the pod is working toward — do your part where the work lives.</p>
                  </div>
                  <StickerButton variant="outline" size="sm" onClick={() => setManageOpen(true)}>
                    <Settings2 className="h-3.5 w-3.5" />
                    Manage{votingCount > 0 ? ` (${votingCount})` : ""}
                  </StickerButton>
                </div>

                {activeGoals.length === 0 ? (
                  <DashEmptyState
                    bare
                    icon={Trophy}
                    title="No goals yet"
                    body="Suggest one and the pod votes on it. A majority makes it live."
                    ctaLabel="Suggest a goal"
                    onCta={() => setSuggestOpen(true)}
                  />
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {activeGoals.map((goal) => {
                      const meta = GOAL_KIND_META[goal.kind];
                      const Icon = meta.icon;
                      const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
                      return (
                        <div key={goal.id} data-goal={goal.id} className="rounded-lg border border-black/10 bg-[#fbfbf7] p-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <span className="mt-0.5 grid h-7 w-7 flex-none place-content-center rounded-full bg-[#e1f073]">
                                <Icon className="h-3.5 w-3.5 text-[#222325]" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-primary">{goal.label}</p>
                                {goal.detail && <p className="mt-0.5 text-xs text-black/50">{goal.detail}</p>}
                              </div>
                            </div>
                            <span className="flex-none text-xs font-semibold tabular-nums text-black/55">
                              {goal.current}/{goal.target}
                            </span>
                          </div>
                          <div className="mt-2.5">
                            <ProgressBar value={pct} fillColor="#cddd54" height="h-1.5" />
                          </div>
                          {meta.href && (
                            <Link href={meta.href} className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                              {meta.actionLabel}
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </DashCard>

              <DashCard className="p-6">
                <p className="mb-1 text-[15px] font-bold text-primary">What&apos;s moving</p>
                <p className="mb-4 text-xs text-black/60">Live updates from your pod.</p>

                <div className="mb-4 flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && share()}
                    placeholder="Sent 4 applications this morning…"
                    aria-label="Share an update with your pod"
                    className="min-w-0 flex-1 rounded-lg border-[1.5px] border-black/15 bg-white px-3 py-2 text-sm outline-none placeholder:text-black/35 focus:border-[#222325]"
                  />
                  <StickerButton variant="primary" size="md" onClick={share} disabled={busy || !draft.trim()}>
                    <Send className="h-3.5 w-3.5" />
                    Share
                  </StickerButton>
                </div>

                {overview.moving.length === 0 ? (
                  <DashEmptyState bare icon={UsersRound} title="Nothing yet" body="Be the first to say what you're working on today." />
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {/* A new post arriving is the whole reason to look at this panel, so it slides
                        in rather than appearing between two renders. `layout` keeps the rows below
                        it from jumping as it does. */}
                    <AnimatePresence initial={false}>
                      {overview.moving.map((item) => (
                        <motion.div
                          key={item.id}
                          data-post={item.id}
                          layout={!reduceMotion}
                          initial={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
                          animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3.5",
                            item.hot ? "border-[#cddd54] bg-[#f8fbe8]" : "border-black/10 bg-[#fbfbf7]",
                          )}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-primary">{item.text}</p>
                            <p className="mt-0.5 text-[11px] text-black/40">
                              {item.time}
                              {item.mine && " · you"}
                            </p>
                          </div>
                          {/* The mutation is already optimistic, so the punch lands on the same
                              frame as the count — the button is not waiting for anything. */}
                          <motion.button
                            type="button"
                            onClick={() => toggleFire(item.id)}
                            aria-pressed={item.firedByMe}
                            aria-label={item.firedByMe ? "Remove your fire" : "Add a fire"}
                            whileTap={reduceMotion ? undefined : { scale: 0.88 }}
                            transition={{ type: "spring", stiffness: 620, damping: 18 }}
                            className={cn(
                              "inline-flex flex-none cursor-pointer items-center gap-1 rounded-full border-[1.5px] px-2 py-1 text-[11px] font-bold transition-colors",
                              item.firedByMe ? "border-[#222325] bg-[#e1f073] text-[#222325]" : "border-black/15 bg-white text-black/45 hover:border-black/30",
                            )}>
                            <Flame className="h-3 w-3" />
                            <span className="tabular-nums">{item.fires}</span>
                          </motion.button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </DashCard>
            </div>

            <div className="flex flex-col gap-5">
              <DashCard className="p-6">
                <p className="mb-1 text-[15px] font-bold text-primary">This week</p>
                <p className="mb-4 text-xs text-black/60">Applications logged, most first.</p>
                <ul className="flex flex-col gap-1.5">
                  {members.map((member) => (
                    <li
                      key={member.userId}
                      data-member={member.userId}
                      className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5", member.me && "bg-[#f0f0ea]")}>
                      <span className="w-4 flex-none text-xs font-bold tabular-nums text-black/35">{member.rank}</span>
                      <span className="grid h-8 w-8 flex-none place-content-center overflow-hidden rounded-full bg-[#222325] text-[10px] font-extrabold text-[#e1f073]">
                        <Face member={member} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-primary">{member.name}</span>
                      {member.loggedToday && <Pill variant="positive" className="flex-none">Today</Pill>}
                      <span className="flex-none text-xs tabular-nums text-black/50">{member.apps}</span>
                    </li>
                  ))}
                </ul>
              </DashCard>

              <DashCard className="p-6">
                <p className="mb-1 text-[15px] font-bold text-primary">Pod settings</p>
                <p className="mb-4 text-xs leading-relaxed text-black/45">{pod.criteria}</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setSuggestOpen(true)}
                    className="cursor-pointer rounded-lg border border-black/10 px-3 py-2 text-left text-[13px] font-semibold text-primary hover:bg-[#f6f6f2]">
                    Suggest a goal
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    disabled={busy}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-left text-[13px] font-semibold text-primary hover:bg-[#f6f6f2] disabled:opacity-50">
                    {muted ? <BellOff className="h-3.5 w-3.5 text-black/45" /> : <Bell className="h-3.5 w-3.5 text-black/45" />}
                    {muted ? "Unmute pod notifications" : "Mute pod notifications"}
                  </button>
                  {/* Never the plain action: for the last member out this deletes the pod, and the
                      dialog is where that gets said before it happens. */}
                  <button
                    type="button"
                    onClick={() => setLeaveOpen(true)}
                    disabled={busy}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-left text-[13px] font-semibold text-[#b23c26] hover:bg-[#fdf3f1] disabled:opacity-50">
                    <LogOut className="h-3.5 w-3.5" />
                    {pod.soleMember ? "Delete this pod" : "Leave this pod"}
                  </button>
                </div>
              </DashCard>
            </div>
          </div>
        )}
      </main>

      <InvitePodDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <JoinPodDialog open={joinOpen} onOpenChange={setJoinOpen} />
      <CreatePodDialog open={createOpen} onOpenChange={setCreateOpen} />
      <LeavePodDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
      {manageOpen && <ManageGoalsDialog onClose={() => setManageOpen(false)} onSuggest={() => setSuggestOpen(true)} />}
      <SuggestGoalDialog open={suggestOpen} onOpenChange={setSuggestOpen} onSuggest={handleSuggest} />
    </div>
  );
};

export default PodClient;
