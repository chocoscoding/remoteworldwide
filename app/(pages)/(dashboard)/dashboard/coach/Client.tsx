"use client";

// The career coach.
//
// Every conversation is real. The rail lists this user's sessions from the AI
// service, a session's messages load when it is opened, and each send streams
// the coach's reply in as it is written (hooks/mutations/useSendCoachMessage.ts).
// The coach reads the user's actual search through the backend's context
// bundle, so the header's promise holds, unless the user has turned that off in
// privacy settings, in which case the header says so. The plan under the
// sessions is the user's real plan for this month, and the coach can only add to
// it by asking (ProposalCard).
//
// A new chat costs nothing until its first message: "+" only clears the screen,
// and the first send creates the session and then streams into it.

import { FC, FormEvent, Suspense, UIEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, AudioLines, Clock, CreditCard, Loader2, Mic, Plus, RotateCcw, RotateCw, Send, Square } from "lucide-react";
import { Lottie } from "lottie-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import { initialsOf } from "@/app/components/dashboard/ui/Avatar";
import PlanPanel from "@/app/components/dashboard/plan/PlanPanel";
import ProposalCard from "@/app/components/dashboard/coach/ProposalCard";
import { useVoiceSession } from "@/app/components/dashboard/voice/useVoiceSession";
import InlineTalkBar from "@/app/components/dashboard/voice/InlineTalkBar";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { useVoiceConversation } from "@/app/components/dashboard/voice/useVoiceConversation";
import { useSettings } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import { apiMessage } from "@/app/lib/api/core";
import { COACH_BILLING_HREF, coachCardHref, createCoachSession, describeReplyDone, type CoachFailure } from "@/app/lib/coach/api";
import { backToJobHref, readJobContext } from "@/app/lib/dashboard/contextParams";
import type { SavedJobItem } from "@/app/lib/jobs/types";
import {
  COACH_LIMITS,
  type CoachMessageCard,
  type CoachProposalItem,
  type CoachSessionDetail,
  type CoachSessionList,
  type CreateCoachSessionResult,
} from "@/app/lib/coach/types";
import { qk } from "@/app/lib/query/keys";
import type { Settings } from "@/app/lib/settings/types";
import { periodOf } from "@/app/lib/tasks/types";
import { isTalkActive, problemCopy } from "@/app/lib/voice/talkState";
import { useCoachSession, useCoachSessions } from "@/hooks/queries/useCoachQueries";
import { useSavedJobQuery } from "@/hooks/queries/useJobQueries";
import { useVoiceConfig } from "@/hooks/queries/useVoiceConfig";
import { isDraftKey, isTurnInFlight, useSendCoachMessage, type CoachTurn } from "@/hooks/mutations/useSendCoachMessage";

// Links styled as sticker buttons rather than a <button> nested inside an <a>,
// which is invalid HTML and gives keyboard users two tab stops for one action.
const OUTLINE_LINK = cn(stickerButtonVariants({ variant: "outline", size: "sm" }), "hover:shadow-[3px_3px_0_0_#e1f073]");
const PRIMARY_LINK = cn(stickerButtonVariants({ variant: "primary", size: "sm" }), "hover:shadow-[3px_3px_0_0_#e1f073]");

const PRIVACY_HREF = "/dashboard/settings/privacy";

const RAIL_SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-2/3"] as const;

/**
 * How close to the bottom the reader must be for a streaming reply to pull the
 * transcript along. Scrolled further up, they are reading something earlier
 * and are left where they are.
 */
const FOLLOW_SLACK_PX = 96;

/** Live dictation under the composer shows its newest words, on one line. */
const INTERIM_TAIL_CHARS = 90;
const interimTail = (text: string) => (text.length > INTERIM_TAIL_CHARS ? `…${text.slice(-INTERIM_TAIL_CHARS).trimStart()}` : text);

/** What the transcript's status region says about a turn. Nothing for a failure, which announces itself. */
function turnAnnouncement(turn: CoachTurn | undefined): string {
  if (!turn) return "";
  if (isTurnInFlight(turn)) return "Coach is replying…";
  return turn.status === "done" ? describeReplyDone(turn) : "";
}

/** Voice minutes are counted per UTC day, so they come back at the next UTC midnight after `from`. */
function minutesBackAt(from: number): string {
  const at = new Date(from);
  at.setUTCHours(24, 0, 0, 0);
  return at.toISOString();
}

/**
 * The start of a question about a saved job, left in the composer for the user
 * to finish. Null when the job names neither a role nor a company.
 */
function jobDraftFor({ company, role }: Pick<SavedJobItem, "company" | "role">): string | null {
  const r = role?.trim();
  const c = company?.trim();
  const subject = r && c ? `the ${r} role at ${c}` : r ? `the ${r} role` : c ? `a role at ${c}` : null;
  return subject ? `I'm looking at ${subject}. `.slice(0, COACH_LIMITS.messageMax) : null;
}

/** A session made for a call goes into the rail and the cache at once, as a typed first message's does. */
function storeTalkSession(queryClient: QueryClient, { session, usage }: CreateCoachSessionResult) {
  const list = queryClient.getQueryData<CoachSessionList>(qk.coach.sessions());
  if (list) queryClient.setQueryData<CoachSessionList>(qk.coach.sessions(), { sessions: [session, ...list.sessions.filter((other) => other.id !== session.id)], usage });
  else void queryClient.invalidateQueries({ queryKey: qk.coach.sessions() });
  if (!queryClient.getQueryData(qk.coach.session(session.id))) {
    queryClient.setQueryData<CoachSessionDetail>(qk.coach.session(session.id), { session, messages: [], usage });
  }
}

const CoachBadge: FC = () => (
  <div className="h-7 w-7 flex-none rounded-full bg-secondary text-primary font-extrabold text-[10px] flex items-center justify-center mt-0.5">
    RW
  </div>
);

const UserBadge: FC<{ initials: string }> = ({ initials }) => (
  <div className="h-7 w-7 flex-none rounded-full bg-primary text-secondary font-extrabold text-[10px] flex items-center justify-center mt-0.5">
    {initials}
  </div>
);

interface MessageRowProps {
  from: "coach" | "user";
  text: string;
  card?: CoachMessageCard | null;
  proposal?: CoachProposalItem | null;
  initials: string;
}

/** One message in the transcript, stored or still arriving. */
const MessageRow: FC<MessageRowProps> = ({ from, text, card = null, proposal = null, initials }) => {
  // A card whose link is not a dashboard screen is not shown at all.
  const cardHref = card ? coachCardHref(card) : null;
  return (
    <div className={cn("flex gap-2.5 items-start", from === "user" && "justify-end")}>
      {from === "coach" && <CoachBadge />}
      <div className={cn("max-w-[78%] flex flex-col gap-2.5", from === "user" && "items-end")}>
        {text && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line break-words",
              from === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-[#f0f0ea] text-black/80 rounded-tl-sm",
            )}>
            {text}
          </div>
        )}
        {card && cardHref && (
          <DashCard className="bg-[#fbfbf7] p-4 w-full flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-primary">{card.title}</p>
            <Link href={cardHref} className={cn(OUTLINE_LINK, "flex-none")}>
              {card.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </DashCard>
        )}
        {proposal && <ProposalCard proposal={proposal} />}
      </div>
      {from === "user" && <UserBadge initials={initials} />}
    </div>
  );
};

// Announced through the transcript's status region rather than here: this
// bubble is gone the moment the first words land.
const TypingBubble: FC = () => (
  <div className="flex gap-2.5 items-start" data-thinking>
    <CoachBadge />
    <div aria-label="Coach is typing" className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-[#f0f0ea] px-4 py-3.5">
      <span className="h-1.5 w-1.5 rounded-full bg-black/35 animate-bounce" />
      <span className="h-1.5 w-1.5 rounded-full bg-black/35 animate-bounce [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-black/35 animate-bounce [animation-delay:240ms]" />
    </div>
  </div>
);

/** Where the reply would have been: why it isn't, and a Retry that sends the same message under the same id. */
const FailureRow: FC<{ failure: CoachFailure; onRetry: () => void; retryDisabled: boolean }> = ({ failure, onRetry, retryDisabled }) => {
  const retry = failure.retryable ? (
    <StickerButton variant="outline" size="sm" onClick={onRetry} disabled={retryDisabled}>
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      Retry
    </StickerButton>
  ) : null;

  if (failure.kind === "credits") {
    return (
      <div className="flex gap-2.5 items-start" role="alert">
        <CoachBadge />
        <div className="max-w-[78%] rounded-xl border-[1.5px] border-[#222325] bg-white px-4 py-3.5 shadow-[3px_3px_0_0_#e1f073]">
          <div className="flex items-start gap-2.5">
            <CreditCard className="h-4 w-4 flex-none text-primary mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-bold text-primary">You&apos;re out of credits</p>
              <p className="mt-1 text-sm text-black/60 leading-relaxed">{failure.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {/* A new tab, so this message and its Retry are still here once the top-up is done. */}
                <Link href={COACH_BILLING_HREF} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK}>
                  Get credits
                </Link>
                {retry}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // A clock time rather than "in 20 minutes", which would be wrong a minute after it rendered.
  const retryTime =
    failure.kind === "limited" && failure.retryAt !== null
      ? new Date(failure.retryAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : null;

  return (
    <div className="flex gap-2.5 items-start" role="alert">
      <CoachBadge />
      <div className="max-w-[78%] rounded-2xl rounded-tl-sm border border-[#b23c26]/20 bg-[#fdf4f2] px-4 py-3">
        <div className="flex items-start gap-2">
          {failure.kind === "limited" ? (
            <Clock className="h-4 w-4 flex-none text-[#b23c26] mt-0.5" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-none text-[#b23c26] mt-0.5" aria-hidden />
          )}
          <div>
            <p className="text-sm text-[#b23c26] leading-relaxed">{failure.message}</p>
            {retryTime && <p className="mt-0.5 text-xs font-medium text-[#b23c26]/80">You can send again after {retryTime}.</p>}
          </div>
        </div>
        {retry && <div className="mt-2.5">{retry}</div>}
      </div>
    </div>
  );
};

interface TurnRowsProps {
  turn: CoachTurn;
  /** The user's message is already among the session's stored messages, which show it. */
  userStored: boolean;
  initials: string;
  onRetry: (turnKey: string) => void;
  retryDisabled: boolean;
}

/** A turn on its way into the session: the message, the reply as it arrives, and a failure if there is one. */
const TurnRows: FC<TurnRowsProps> = ({ turn, userStored, initials, onRetry, retryDisabled }) => {
  const { final } = turn;
  const text = final ? final.text : turn.reply;
  const card = final ? final.card : turn.card;
  const proposal = final ? final.proposal : turn.proposal;
  return (
    <>
      {!userStored && <MessageRow from="user" text={turn.userMessage?.text ?? turn.text} initials={initials} />}
      {(text || card || proposal) && <MessageRow from="coach" text={text} card={card} proposal={proposal} initials={initials} />}
      {turn.failure && <FailureRow failure={turn.failure} onRetry={() => onRetry(turn.key)} retryDisabled={retryDisabled} />}
    </>
  );
};

const CoachScreen: FC = () => {
  const sessionsQuery = useCoachSessions();
  const { turns, send, retry } = useSendCoachMessage();
  // null = a new chat: the default when you land, and what "+" returns to.
  // Otherwise a session id, or a draft key while a new chat's session is being created.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const shapeRef = useRef("");

  // A link from a job's own screen (?job=<saved job id>) starts a question
  // about that job in a new chat's composer, for the user to finish. Words are
  // the only way to name a job here: a session holds nothing but its messages,
  // and the context bundle is the account, not one posting. Never sent for
  // them, since a reply can cost a credit. Read back from saved jobs rather
  // than the link's labels, once, and only into an empty composer; a job that
  // has gone leaves it empty.
  const params = useSearchParams();
  const context = readJobContext(params, "job");
  const [contextFor, setContextFor] = useState<string | null>(null);
  const [draftedFor, setDraftedFor] = useState<string | null>(null);
  const contextPending = context.savedJobId !== null && contextFor !== context.savedJobId;
  const saved = useSavedJobQuery(contextPending ? context.savedJobId : null);
  const savedJob = saved.data && saved.data.id === context.savedJobId ? saved.data : null;
  if (contextPending && (savedJob || saved.isError)) {
    setContextFor(context.savedJobId);
    const jobDraft = savedJob ? jobDraftFor(savedJob) : null;
    if (jobDraft && activeKey === null && !draft.trim()) {
      setDraft(jobDraft);
      setDraftedFor(context.savedJobId);
    }
  }
  const backHref = backToJobHref(context);

  const draftTurn = activeKey !== null && isDraftKey(activeKey) ? turns.find((turn) => turn.draftKey === activeKey) : undefined;
  // A draft nothing holds any more (its session never came, and it was dropped) is a new chat again.
  const viewKey = activeKey !== null && isDraftKey(activeKey) && !draftTurn ? null : activeKey;
  // A draft turns into its session the moment the session exists, without the view changing.
  const activeSessionId = viewKey === null ? null : draftTurn ? draftTurn.sessionId : viewKey;
  const sessionQuery = useCoachSession(activeSessionId);

  const stored = sessionQuery.data?.messages ?? [];
  const storedIds = new Set(stored.map((message) => message.id));
  // Turns follow their session, so a reply keeps writing into the conversation
  // it belongs to while another one is on screen.
  const viewTurns =
    viewKey === null ? [] : turns.filter((turn) => turn.draftKey === viewKey || (activeSessionId !== null && turn.sessionId === activeSessionId));
  // A turn steps aside once its reply is among the stored messages, which then show it.
  const liveTurns = viewTurns.filter((turn) => !(turn.final && storedIds.has(turn.final.id)));
  const busy = viewTurns.some(isTurnInFlight);
  const lastTurn = liveTurns.length > 0 ? liveTurns[liveTurns.length - 1] : undefined;
  // The typing bubble lasts until the first words arrive, then the reply bubble takes its place.
  const typing = lastTurn !== undefined && isTurnInFlight(lastTurn) && lastTurn.reply === "";

  const { profile, privacy } = useSettings();
  // The same account the sidebar shows: the settings profile, not a mock.
  const initials = initialsOf(profile.fullName) || "?";
  // Off means the context bundle carries no applications, outcomes or goal, and
  // the coach says it can't see them. Read from what is SAVED: useSettings()
  // layers unsaved edits over it, and a toggle flipped on the privacy screen but
  // never saved changes nothing the service sees. SettingsProvider re-renders
  // this screen whenever the saved settings change, so the cache read is current.
  const queryClient = useQueryClient();
  const savedPrivacy = queryClient.getQueryData<Settings>(qk.settings.me())?.privacy ?? privacy;
  const coachingOff = savedPrivacy.allowAiCoaching === false;

  // Dictated speech lands in the same draft as typing, so everything
  // downstream of the composer stays identical either way.
  const handleTranscript = useCallback((text: string) => {
    setDraft((prev) => (prev ? `${prev.trimEnd()} ${text.trim()}` : text.trim()).slice(0, COACH_LIMITS.messageMax));
  }, []);
  // The coach doesn't talk back out loud — this is dictation only.
  const { micStatus, dictationSupported, interim, startDictation, stopDictation } = useVoiceSession({
    onTranscript: handleTranscript,
    voiceEnabled: false,
  });
  const listening = micStatus === "listening";
  // A start still waiting on the mic prompt: the mic button calls it off, and so does sending.
  const requesting = micStatus === "requesting";

  // Talk mode. A call's turns are stored in this session, so it is read again as each one settles.
  const voiceConfig = useVoiceConfig();
  const talkOn = !!voiceConfig.data?.spokenEnabled && !!voiceConfig.data?.features.coach.enabled;
  const talkSessionRef = useRef<string | null>(null);
  const refreshGate = useRef({ running: false, again: false });
  // One refetch in flight; whatever is asked meanwhile becomes one more after it.
  const refreshTalkSession = useCallback(() => {
    const gate = refreshGate.current;
    if (gate.running) {
      gate.again = true;
      return;
    }
    gate.running = true;
    void (async () => {
      try {
        do {
          gate.again = false;
          const id = talkSessionRef.current;
          if (id) {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: qk.coach.session(id) }),
              queryClient.invalidateQueries({ queryKey: qk.coach.sessions() }),
            ]);
          }
        } while (gate.again);
      } finally {
        gate.running = false;
      }
    })().catch(() => undefined);
  }, [queryClient]);
  // The call's end also settles its last turn (onTurnSettled); what is left is today's minutes.
  const refreshVoiceConfig = useCallback(() => void queryClient.invalidateQueries({ queryKey: qk.voice.config() }), [queryClient]);
  const talk = useVoiceConversation({
    feature: "coach",
    targetId: activeSessionId,
    enabled: talkOn,
    onTurnSettled: refreshTalkSession,
    onEnded: refreshVoiceConfig,
  });
  const { start: startTalk, end: endTalk, reset: resetTalk } = talk;
  const talkActive = isTalkActive(talk.state);
  // True while a new chat's session is being created for a call.
  const [talkOpening, setTalkOpening] = useState(false);
  const talking = talkActive || talkOpening;
  const showTalk = talkActive || talk.problem !== null;
  const outOfMinutes = voiceConfig.data?.remainingSeconds === 0;
  const minutesBack = outOfMinutes ? minutesBackAt(voiceConfig.dataUpdatedAt) : null;
  const talkReason = talkActive
    ? null
    : minutesBack !== null
      ? problemCopy({ kind: "minutes", retryAt: minutesBack })
      : busy
        ? "Wait for the coach to finish replying"
        : null;
  const talkLabel = talkActive ? "End voice call" : talkReason ? `Talk to your coach. ${talkReason}` : "Talk to your coach";
  const talkCaption = talk.state !== "live" ? "" : talk.agentCaption ? `Coach: ${talk.agentCaption}` : talk.userCaption ? `You: ${talk.userCaption}` : "";
  const pendingTalkRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const talkButtonRef = useRef<HTMLButtonElement>(null);
  const typeFocusRef = useRef(false);

  // A tab left open past the reset asks again instead of staying locked until a reload.
  useEffect(() => {
    if (minutesBack === null) return;
    const timer = setTimeout(refreshVoiceConfig, Math.max(0, Date.parse(minutesBack) - Date.now()) + 30_000);
    return () => clearTimeout(timer);
  }, [minutesBack, refreshVoiceConfig]);

  const handleTalk = async () => {
    if (talkActive) {
      typeFocusRef.current = true;
      endTalk();
      return;
    }
    if (activeSessionId !== null) {
      talkSessionRef.current = activeSessionId;
      startTalk();
      return;
    }
    // A new chat, or one whose first message never got its session.
    if (talkOpening || busy) return;
    const from = activeKey;
    setTalkOpening(true);
    try {
      const created = await createCoachSession();
      storeTalkSession(queryClient, created);
      pendingTalkRef.current = created.session.id;
      // Only if still where Talk was pressed; a user who has moved on stays where they went.
      setActiveKey((key) => (key === from ? created.session.id : key));
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setTalkOpening(false);
    }
  };

  // Started after the render that names the new session: the hook reads its target from the last commit.
  useEffect(() => {
    const pending = pendingTalkRef.current;
    if (pending === null || talkOpening) return;
    pendingTalkRef.current = null;
    if (pending !== activeSessionId) return;
    talkSessionRef.current = pending;
    startTalk();
  }, [activeSessionId, talkOpening, startTalk]);

  // Dictation and a call would share the mic.
  useEffect(() => {
    if (talking && (listening || requesting)) stopDictation();
  }, [talking, listening, requesting, stopDictation]);

  const handleTypeInstead = useCallback(() => {
    resetTalk();
    typeFocusRef.current = true;
  }, [resetTalk]);

  // The composer stays disabled until the call has ended, so focus waits for that.
  useEffect(() => {
    if (talking || !typeFocusRef.current) return;
    typeFocusRef.current = false;
    inputRef.current?.focus();
  }, [talking, showTalk]);

  // A question started from a job link is picked up where it stops: focus, with the caret after its words.
  useEffect(() => {
    if (draftedFor !== null) inputRef.current?.focus();
  }, [draftedFor]);

  // A retried message is a typed send: locked during a call, and it closes a refusal's panel like one.
  const handleRetry = (turnKey: string) => {
    if (talking) return;
    resetTalk();
    retry(turnKey);
  };

  const itemCount = stored.length + liveTurns.length;
  const tail = lastTurn ? lastTurn.reply.length : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // A different conversation, or a new message in this one, always comes into
    // view. A reply that is only growing pulls the view along if the reader was
    // already at the bottom.
    const shape = `${viewKey ?? "new"}:${itemCount}`;
    const moved = shape !== shapeRef.current;
    shapeRef.current = shape;
    if (moved) followRef.current = true;
    if (moved || followRef.current) el.scrollTo({ top: el.scrollHeight, behavior: moved ? "smooth" : "auto" });
  }, [viewKey, itemCount, typing, tail]);

  const handleTranscriptScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_SLACK_PX;
  };

  const sessions = sessionsQuery.data?.sessions ?? [];
  // A new chat whose session is still being created is in the rail at once, untitled, like the session it is about to be.
  const creating = turns.flatMap((turn) =>
    turn.draftKey !== null && turn.sessionId === null && turn.status === "creating" ? [{ key: turn.draftKey, title: null }] : [],
  );
  const rows: { key: string; title: string | null }[] = [...creating, ...sessions.map((session) => ({ key: session.id, title: session.title }))];

  const handleNewSession = () => {
    setActiveKey(null);
    setDraft("");
    if (listening || requesting) stopDictation();
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy || talking) return;
    const turn = send(activeSessionId, text);
    if (!turn) return;
    resetTalk();
    setDraft("");
    if (listening || requesting) stopDictation();
    // First message of a new chat: the view follows the draft, and the draft becomes its session.
    if (turn.draftKey) setActiveKey(turn.draftKey);
  };

  return (
    <div className="h-screen flex flex-col bg-[#f6f6f6] overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold text-primary leading-tight truncate">Career coach</h1>
          <p className="text-xs text-black/45 truncate">
            {coachingOff ? (
              <>
                Can&apos;t see your applications or results.{" "}
                <Link href={PRIVACY_HREF} className="font-semibold text-primary underline-offset-2 hover:underline">
                  Privacy settings
                </Link>
              </>
            ) : (
              "Knows your profile, applications and results"
            )}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          {backHref && (
            <Link href={backHref} className={OUTLINE_LINK}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to the job
            </Link>
          )}
          <NotificationBell />
        </div>
      </header>

      {/* The dashboard header is h-16; this claims the rest and never
          scrolls the page — each column scrolls on its own instead. */}
      <main className="flex-1 min-h-0 px-6 py-5">
        <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[264px_1fr]">
          {/* One dark rail: sessions above, the plan below, split by a rule.
              Proportional rather than content-sized so neither list can push
              the other off-screen — each scrolls inside its own share. */}
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-[#222325] text-white order-first">
            {/* Sessions — the larger share, since the list grows without bound. */}
            <div className="flex min-h-0 flex-[1_1_63%] flex-col px-3 pt-3.5">
              <div className="mb-1.5 flex flex-none items-center justify-between gap-2 px-2">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/45">Sessions</p>
                <button
                  type="button"
                  onClick={handleNewSession}
                  aria-label="Start a new session"
                  title="New session"
                  className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-md border-[1.5px] border-[#e1f073] bg-[#e1f073] text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_rgba(255,255,255,.3)] hover:shadow-[2.5px_2.5px_0_0_rgba(255,255,255,.45)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.75} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-3">
                {sessionsQuery.isPending &&
                  rows.length === 0 &&
                  RAIL_SKELETON_WIDTHS.map((width) => (
                    <div key={width} aria-hidden className="flex h-7 w-full flex-none items-center gap-2 px-2">
                      <span className="h-1.5 w-1.5 flex-none rounded-full bg-white/15" />
                      <span className={cn("h-2.5 animate-pulse rounded bg-white/10", width)} />
                    </div>
                  ))}

                {sessionsQuery.isError && !sessionsQuery.data && (
                  <div role="alert" className="flex h-7 w-full flex-none items-center gap-2 px-2 text-xs text-white/55">
                    <span className="min-w-0 flex-1 truncate">Couldn&apos;t load your sessions</span>
                    <button
                      type="button"
                      onClick={() => void sessionsQuery.refetch()}
                      disabled={sessionsQuery.isFetching}
                      className="inline-flex flex-none cursor-pointer items-center gap-1 rounded font-bold text-[#e1f073] hover:underline disabled:cursor-default disabled:opacity-60">
                      {sessionsQuery.isFetching ? <Loader2 aria-hidden className="h-3 w-3 animate-spin" /> : <RotateCw aria-hidden className="h-3 w-3" />}
                      Retry
                    </button>
                  </div>
                )}

                {sessionsQuery.data && rows.length === 0 && (
                  <p className="flex-none px-2 py-1.5 text-xs leading-relaxed text-white/45">No sessions yet. Each conversation is kept here.</p>
                )}

                {rows.map((sn) => {
                  const active = viewKey === sn.key || (activeSessionId !== null && activeSessionId === sn.key);
                  const untitled = sn.title === null;
                  return (
                    <button
                      key={sn.key}
                      type="button"
                      onClick={() => setActiveKey(sn.key)}
                      title={sn.title ?? "No title"}
                      data-session={sn.key}
                      data-untitled={untitled ? "true" : undefined}
                      className={cn(
                        // Fixed height, not padding — every row is the same
                        // size no matter how long the title is.
                        "group flex h-7 w-full flex-none items-center gap-2 rounded-md px-2 text-left text-xs cursor-pointer",
                        "transition-[transform,box-shadow,background-color] duration-100 ease-out",
                        "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                        // The hard shadow is the SELECTED state only. Putting it
                        // on hover too made every row feel like a heavy button.
                        active
                          ? "bg-white font-bold text-[#222325] shadow-[2px_2px_0_0_#e1f073]"
                          : "bg-transparent font-medium text-white/65 hover:bg-white/10 hover:text-white",
                      )}>
                      {/* An unnamed session pulses lime until its first message names it. */}
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 flex-none rounded-full transition-colors",
                          untitled ? "animate-pulse bg-[#cddd54]" : active ? "bg-[#222325]" : "bg-white/25 group-hover:bg-[#e1f073]",
                        )}
                      />
                      {/* Titles run long — truncate rather than wrap, the full
                          text is on the tooltip. */}
                      <span className={cn("min-w-0 flex-1 truncate", untitled && "italic font-medium opacity-60")}>
                        {sn.title ?? "No title"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="flex-none border-0 border-t border-white/12" />

            {/* This month's plan — the smaller, bounded share. The panel carries its own flex share. */}
            <PlanPanel period={periodOf(new Date())} variant="dark-rail" />
          </aside>

          {/* Chat column — blank until a session is open or the first message is sent. */}
          <DashCard className="flex min-h-0 h-full flex-col overflow-hidden p-0">
            <div
              ref={scrollRef}
              onScroll={handleTranscriptScroll}
              data-transcript
              className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
              {/* New chat — nothing said yet. Centred prompt so it reads as
                  "start here", not as a broken empty box. */}
              {viewKey === null && (
                <div data-empty className="m-auto flex max-w-[420px] flex-col items-center text-center">
                  <span aria-hidden className="flex items-center justify-center">
                    <Lottie
                      src={`/Lottie/neobrutalism/Help_Support-1_lottie.json`}
                      autoplay
                      loop
                      speed={0.63}
                      style={{ width: 220, height: 220 }}
                    />
                  </span>
                  <p className="text-[15px] font-bold text-primary">Ask your coach anything</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-black/50">
                    {coachingOff
                      ? "Type below or tap the mic to start. Your coach knows your profile, but your applications and results are hidden from it in privacy settings."
                      : "Type below or tap the mic to start. Your coach already knows your profile, applications and results."}
                  </p>
                </div>
              )}

              {activeSessionId !== null &&
                !sessionQuery.data &&
                (sessionQuery.isError ? (
                  <div className="m-auto flex max-w-[340px] flex-col items-center text-center" role="alert">
                    <AlertTriangle className="h-5 w-5 text-[#b23c26]" aria-hidden />
                    <p className="mt-2 text-sm text-[#b23c26] leading-relaxed">{apiMessage(sessionQuery.error)}</p>
                    <StickerButton
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => void sessionQuery.refetch()}
                      disabled={sessionQuery.isFetching}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      Try again
                    </StickerButton>
                  </div>
                ) : liveTurns.length === 0 ? (
                  <div className="m-auto inline-flex items-center gap-2 text-sm text-black/50" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Opening your conversation…
                  </div>
                ) : null)}

              {stored.map((m) => (
                <MessageRow key={m.id} from={m.from} text={m.text} card={m.card} proposal={m.proposal} initials={initials} />
              ))}

              {liveTurns.map((turn) => (
                <TurnRows
                  key={turn.key}
                  turn={turn}
                  userStored={turn.userMessage !== null && storedIds.has(turn.userMessage.id)}
                  initials={initials}
                  onRetry={handleRetry}
                  retryDisabled={talking}
                />
              ))}

              {/* Typing bubble until the reply's first words arrive. */}
              {typing && <TypingBubble />}
            </div>
            {/* What the reply is doing, for screen readers, from one region that
                stays mounted: replying, then that it arrived and what it cost.
                The transcript isn't a live region, so without this a finished
                reply, and a credit spent on it, would land in silence. Read from
                every turn of this conversation, since a finished turn leaves the
                live list once its reply is stored. Failures are alerts in their
                own bubbles. */}
            <p role="status" className="sr-only">
              {turnAnnouncement(viewTurns[viewTurns.length - 1])}
            </p>

            {/* Sticky bottom composer */}
            <div className="flex-none border-t border-black/10 bg-white px-4 pb-2.5 pt-4">
              <form onSubmit={handleSend} className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex-1 flex items-center gap-2 h-11 rounded-lg border bg-[#f6f6f6] pl-4 pr-2 transition-colors",
                    showTalk && talk.problem
                      ? "border-[#b23c26]/25 bg-[#fdf4f2]"
                      : listening || showTalk
                        ? "border-[#222325]"
                        : "border-black/12 focus-within:border-black/30",
                  )}>
                  {showTalk && (
                    <InlineTalkBar
                      talk={talk}
                      speakingLabel="Coach is speaking"
                      onTypeInstead={handleTypeInstead}
                      controlRef={talkButtonRef}
                      className="flex-1 self-stretch"
                    />
                  )}
                  {/* A one-line textarea rather than an input: password managers
                      (NordPass has no opt-out attribute) offer saved cards and
                      logins on inputs, and leave textareas alone. Enter sends and
                      newlines are dropped, so it behaves like the input it replaced. */}
                  <textarea
                    ref={inputRef}
                    rows={1}
                    wrap="off"
                    autoComplete="off"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.replace(/\r?\n/g, " "))}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }}
                    maxLength={COACH_LIMITS.messageMax}
                    disabled={talking}
                    aria-label="Message your coach"
                    placeholder={talking ? "End the call to type" : listening ? "Listening…" : "Ask your coach anything…"}
                    className={cn(
                      "flex-1 min-w-0 h-5 resize-none overflow-hidden bg-transparent text-sm leading-5 text-primary placeholder:text-black/40 focus:outline-none disabled:cursor-not-allowed",
                      showTalk && "hidden",
                    )}
                  />
                  <button
                    type="button"
                    onClick={listening || requesting ? stopDictation : startDictation}
                    disabled={!dictationSupported || micStatus === "denied" || talking}
                    aria-pressed={listening}
                    aria-label={listening ? "Stop dictating" : requesting ? "Cancel dictation" : "Dictate your message"}
                    title={
                      micStatus === "denied"
                        ? "Mic blocked — type instead"
                        : !dictationSupported
                          ? "Dictation isn't available in this browser"
                          : listening
                            ? "Stop dictating"
                            : requesting
                              ? "Cancel dictation"
                              : micStatus === "unavailable"
                                ? "Dictation isn't available right now — type instead"
                                : "Dictate"
                    }
                    className={cn(
                      "inline-flex h-8 w-8 flex-none items-center justify-center rounded-md cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none",
                      listening ? "bg-[#222325] text-[#e1f073]" : "text-black/45 hover:bg-black/5 hover:text-primary",
                      showTalk && "hidden",
                    )}>
                    {micStatus === "requesting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  </button>
                  {talkOn && (
                    // A disabled button gets no hover, so its reason rides on the wrapper's tooltip.
                    <span className="inline-flex flex-none" title={talkReason ?? talkLabel}>
                      <StickerButton
                        ref={talkButtonRef}
                        variant={talkActive ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => void handleTalk()}
                        disabled={talkOpening || talk.state === "ending" || (!talkActive && (busy || outOfMinutes))}
                        aria-label={talkLabel}
                        className={talkActive ? undefined : "border-[1.5px] border-[#222325] hover:shadow-[2px_2px_0_0_#222325]"}>
                        {talkOpening ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : talkActive ? (
                          <Square className="h-3 w-3 fill-current" aria-hidden />
                        ) : (
                          <AudioLines className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {talkActive ? "End" : "Talk"}
                      </StickerButton>
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!draft.trim() || busy || talking || showTalk}
                  aria-label="Send"
                  title="Send"
                  className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border-[1.5px] border-[#222325] bg-[#222325] text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30 disabled:pointer-events-none">
                  <Send className="h-4 w-4" />
                </button>
              </form>
              {/* While dictating, the words not final yet: the input's placeholder
                  can show them only while the box is empty, and after the first
                  pause it never is. In a call, the live caption. The line keeps
                  its height when empty, so the composer doesn't jump. */}
              <p className="mt-2 min-h-[1rem] px-1 text-[11px] font-medium text-black/45">
                {listening && interim ? (
                  <span data-interim className="block truncate italic text-black/60">
                    {interimTail(interim)}
                  </span>
                ) : talkCaption ? (
                  <span data-caption className="block truncate italic text-black/60">
                    {talkCaption}
                  </span>
                ) : null}
              </p>
            </div>
          </DashCard>
        </div>
      </main>
    </div>
  );
};

/** The screen's frame, shown only if the page is ever prerendered without search params. */
const CoachFallback: FC = () => (
  <div className="h-screen flex flex-col bg-[#f6f6f6] overflow-hidden">
    <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
      <h1 className="text-[17px] font-bold text-primary leading-tight truncate">Career coach</h1>
      <NotificationBell />
    </header>
  </div>
);

// useSearchParams needs a Suspense boundary for a prerendered page. This one
// renders per request (the dashboard layout reads the session), so the fallback
// should never show; the boundary keeps the screen correct if that changes.
const CoachClient: FC = () => (
  <Suspense fallback={<CoachFallback />}>
    <CoachScreen />
  </Suspense>
);

export default CoachClient;
