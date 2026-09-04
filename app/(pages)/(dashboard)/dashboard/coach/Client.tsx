"use client";

import { FC, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mic, Plus, Send } from "lucide-react";
import { Lottie } from "lottie-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import { COACH_MESSAGES, COACH_PLAN, COACH_SESSIONS } from "@/app/lib/dashboard/mock-data";
import type { CoachMessage, CoachPlanItem } from "@/app/lib/dashboard/types";
import { useVoiceSession } from "@/app/components/dashboard/voice/useVoiceSession";
import MicWaveform from "@/app/components/dashboard/voice/MicWaveform";

// ---------------------------------------------------------------------------
// Local content that isn't shared with any other screen — the canned coach
// replies used when the composer "sends" a message, and a short transcript
// for each session that already exists in the rail. No real AI call.
// ---------------------------------------------------------------------------

const CANNED_REPLIES: string[] = [
  "That's a fair read. Let's test it — lead with the async angle on two more applications this week and see if reply speed changes.",
  "I'd hold off rewriting your resume over one data point. Give it another week before we call it a pattern.",
  "Good instinct — add a line about that to your next cover letter, and I'll check the reply rate again on Friday.",
  "Worth asking directly rather than guessing. Recruiters usually answer that one honestly if you just raise it in the screen.",
  "That lines up with what I'm seeing across your pod, too — it's not just you.",
];

const SEEDED_TRANSCRIPTS: Record<string, CoachMessage[]> = {
  "session-1": [
    { id: "s1-1", from: "user", text: "How do I ask for USD when the company is US-based but I'm in Lagos?" },
    {
      id: "s1-2",
      from: "coach",
      text: "Anchor on the role's US band, not on local rates — you're solving the same problem as a hire in Austin. Say your range in USD once, early, and let the silence work. If they raise location, that's the moment to mention a contractor setup costs them less than a US employee at the same number.",
    },
    { id: "s1-3", from: "user", text: "And if they say the budget is fixed in naira?" },
    {
      id: "s1-4",
      from: "coach",
      text: "Then it's a different job than the one listed. Ask what the USD equivalent is at today's rate and whether it's indexed — a fixed naira number is a pay cut every quarter.",
    },
  ],
  "session-2": [
    { id: "s2-1", from: "user", text: "Deel offered a 6-month contract instead of the full-time role. Take it?" },
    {
      id: "s2-2",
      from: "coach",
      text: "Take it if two things are true: the day rate is at least 20% above the salaried equivalent, and there's a named conversion path in writing. Without the second one you're the easiest line item to cut in month five.",
    },
  ],
  "session-3": [
    { id: "s3-1", from: "user", text: "There's a 14-month gap on my resume. How do I explain it?" },
    {
      id: "s3-2",
      from: "coach",
      text: "One sentence, no apology, then pivot to what you built. 'I took 2023 to care for family and shipped two side projects in that time' answers it completely — the follow-up question will be about the projects, which is exactly where you want it.",
    },
  ],
};

/** A conversation in the rail. `title` is null until the coach has named it. */
interface Session {
  id: string;
  title: string | null;
  messages: CoachMessage[];
  /** True while a reply is being written — shows the typing bubble. */
  thinking: boolean;
}

const INITIAL_SESSIONS: Session[] = [
  { id: "session-0", title: "This week's reply rate", messages: COACH_MESSAGES, thinking: false },
  ...COACH_SESSIONS.map((s) => ({ id: s.id, title: s.title, messages: SEEDED_TRANSCRIPTS[s.id] ?? [], thinking: false })),
];

let seq = 0;
function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

/**
 * The name a session gets from its first question — a crude stand-in for
 * the model naming it. Drops the question lead-in, keeps the first six
 * words, trims to a row's width. Deterministic, so the same question always
 * lands on the same title.
 */
const QUESTION_LEADS =
  /^(should i|can i|could i|how do i|how can i|how should i|what should i|what do i|do i|is it|what's|what is|whats|why do|why is|when should i|where do i|i want to|i need to|help me)\s+/i;

function titleFromQuestion(question: string): string {
  let t = question.trim().replace(/[?!.]+$/, "").replace(QUESTION_LEADS, "");
  t = t.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  if (t.length > 40) t = t.slice(0, 40).replace(/\s+\S*$/, "");
  return t ? t[0].toUpperCase() + t.slice(1) : "New session";
}

// The two beats after a send. Naming runs alongside the reply, not after it.
const NAME_DELAY_MS = 700;
const REPLY_DELAY_MS = 1100;

const CoachBadge: FC = () => (
  <div className="h-7 w-7 flex-none rounded-full bg-secondary text-primary font-extrabold text-[10px] flex items-center justify-center mt-0.5">RW</div>
);

const CoachClient: FC = () => {
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  // null = a new chat: the default when you land, and what "+" returns to.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [planItems, setPlanItems] = useState<CoachPlanItem[]>(COACH_PLAN);
  const [replyIndex, setReplyIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = activeSessionId !== null ? sessions.find((s) => s.id === activeSessionId) : undefined;
  const messageCount = activeSession?.messages.length ?? 0;
  const thinking = activeSession?.thinking ?? false;

  // Dictated speech lands in the same draft as typing, so everything
  // downstream of the composer stays identical either way.
  const handleTranscript = useCallback((text: string) => {
    setDraft((prev) => (prev ? `${prev.trimEnd()} ${text.trim()}` : text.trim()));
  }, []);

  // The coach doesn't talk back out loud — this is dictation only.
  const { micStatus, dictationSupported, startDictation, stopDictation, onLevel } = useVoiceSession({
    onTranscript: handleTranscript,
    voiceEnabled: false,
  });
  const listening = micStatus === "listening";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [activeSessionId, messageCount, thinking]);

  const planDone = planItems.filter((p) => p.done).length;

  const togglePlanItem = (id: string) => {
    setPlanItems((prev) => prev.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
  };

  const handleNewSession = () => {
    setActiveSessionId(null);
    setDraft("");
    if (listening) stopDictation();
  };

  /** Patch one session by id — replies land in the session they belong to even if you've switched away. */
  const patchSession = (id: string, patch: (s: Session) => Session) =>
    setSessions((prev) => prev.map((s) => (s.id === id ? patch(s) : s)));

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const userMsg: CoachMessage = { id: nextId("msg-user"), from: "user", text };
    const reply: CoachMessage = { id: nextId("msg-coach"), from: "coach", text: CANNED_REPLIES[replyIndex % CANNED_REPLIES.length] };
    setReplyIndex((i) => i + 1);
    setDraft("");
    if (listening) stopDictation();

    let sessionId = activeSessionId;
    if (sessionId === null) {
      // First message of a new chat: the session appears in the rail at
      // once, untitled, and gets its name while the reply is being written.
      sessionId = nextId("session");
      const fresh: Session = { id: sessionId, title: null, messages: [userMsg], thinking: true };
      setSessions((prev) => [fresh, ...prev]);
      setActiveSessionId(sessionId);
      const title = titleFromQuestion(text);
      const id = sessionId;
      window.setTimeout(() => patchSession(id, (s) => (s.title === null ? { ...s, title } : s)), NAME_DELAY_MS);
    } else {
      patchSession(sessionId, (s) => ({ ...s, messages: [...s.messages, userMsg], thinking: true }));
    }

    const id = sessionId;
    window.setTimeout(() => patchSession(id, (s) => ({ ...s, messages: [...s.messages, reply], thinking: false })), REPLY_DELAY_MS);
  };

  return (
    <div className="h-screen flex flex-col bg-[#f6f6f6] overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold text-primary leading-tight truncate">Career coach</h1>
          <p className="text-xs text-black/45 truncate">Knows your profile, applications and results</p>
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
                {sessions.map((sn) => {
                  const active = activeSessionId === sn.id;
                  const untitled = sn.title === null;
                  return (
                    <button
                      key={sn.id}
                      type="button"
                      onClick={() => setActiveSessionId(sn.id)}
                      title={sn.title ?? "No title"}
                      data-session={sn.id}
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
                          : "bg-transparent font-medium text-white/65 hover:bg-white/10 hover:text-white"
                      )}>
                      {/* An unnamed session pulses lime until the coach names it. */}
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 flex-none rounded-full transition-colors",
                          untitled ? "animate-pulse bg-[#cddd54]" : active ? "bg-[#222325]" : "bg-white/25 group-hover:bg-[#e1f073]"
                        )}
                      />
                      {/* Titles run long — truncate rather than wrap, the full
                          text is on the tooltip. */}
                      <span className={cn("min-w-0 flex-1 truncate", untitled && "italic font-medium opacity-60")}>{sn.title ?? "No title"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="flex-none border-0 border-t border-white/12" />

            {/* This month's plan — the smaller, bounded share. */}
            <div className="flex min-h-0 flex-[1_1_37%] flex-col px-3 pb-3.5 pt-3">
              <div className="mb-1.5 flex flex-none items-center justify-between gap-2 px-2">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/45">This month&apos;s plan</p>
                <span className="text-[11px] font-medium text-white/40 tabular-nums">
                  {planDone}/{planItems.length}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                {planItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePlanItem(item.id)}
                    title={item.text}
                    // Same fixed height as a session row: a wrapped task used to
                    // be twice the height of a short one, which made the list
                    // read as ragged rather than as a plan.
                    className="group flex h-7 w-full flex-none items-center gap-2 rounded-md px-2 text-left cursor-pointer transition-colors hover:bg-white/10">
                    <span className="flex-none">
                      <NeoCheckbox checked={item.done} size="sm" dark />
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-xs",
                        item.done ? "text-white/35 line-through" : "font-medium text-white/85"
                      )}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Chat column — blank until a session is open or the first message is sent. */}
          <DashCard className="flex min-h-0 h-full flex-col overflow-hidden p-0">
            <div ref={scrollRef} data-transcript className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
              {/* New chat — nothing said yet. Centred prompt so it reads as
                  "start here", not as a broken empty box. */}
              {!activeSession && (
                <div data-empty className="m-auto flex max-w-[420px] flex-col items-center text-center">
                  <span aria-hidden className="flex items-center justify-center">
                    <Lottie src={`/Lottie/neobrutalism/Help_Support_lottie.json`} autoplay loop speed={0.63} style={{ width: 220, height: 220 }} />
                  </span>
                  <p className="text-[15px] font-bold text-primary">Ask your coach anything</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-black/50">
                    Type below or tap the mic to start. Your coach already knows your profile, applications and results.
                  </p>
                </div>
              )}

              {activeSession?.messages.map((m) => (
                <div key={m.id} className={cn("flex gap-2.5 items-start", m.from === "user" && "justify-end")}>
                  {m.from === "coach" && <CoachBadge />}
                  <div className={cn("max-w-[78%] flex flex-col gap-2.5", m.from === "user" && "items-end")}>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        m.from === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-[#f0f0ea] text-black/80 rounded-tl-sm"
                      )}>
                      {m.text}
                    </div>
                    {m.card && (
                      <DashCard className="bg-[#fbfbf7] p-4 w-full flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-primary">{m.card.title}</p>
                        <Link href={m.card.href} className="flex-none">
                          <StickerButton variant="outline" size="sm">
                            {m.card.cta}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </StickerButton>
                        </Link>
                      </DashCard>
                    )}
                  </div>
                  {m.from === "user" && (
                    <div className="h-7 w-7 flex-none rounded-full bg-primary text-secondary font-extrabold text-[10px] flex items-center justify-center mt-0.5">
                      AO
                    </div>
                  )}
                </div>
              ))}

              {/* Typing bubble while the reply is being written. */}
              {thinking && (
                <div className="flex gap-2.5 items-start" data-thinking>
                  <CoachBadge />
                  <div aria-label="Coach is typing" className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-[#f0f0ea] px-4 py-3.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-black/35 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-black/35 animate-bounce [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-black/35 animate-bounce [animation-delay:240ms]" />
                  </div>
                </div>
              )}
            </div>

            {/* Sticky bottom composer */}
            <form onSubmit={handleSend} className="flex-none border-t border-black/10 p-4 flex items-center gap-2.5 bg-white">
              <div
                className={cn(
                  "flex-1 flex items-center gap-2 h-11 rounded-lg border bg-[#f6f6f6] pl-4 pr-2 transition-colors",
                  listening ? "border-[#222325]" : "border-black/12 focus-within:border-black/30"
                )}>
                {listening ? (
                  // While dictating the field shows the voice itself — the
                  // words land in the input the moment they're recognised.
                  <MicWaveform
                    onLevel={onLevel}
                    active
                    bars={18}
                    barWidth={2}
                    gap={2}
                    height="h-5"
                    activeClassName="bg-[#222325]"
                    idleClassName="bg-black/20"
                    className="flex-none w-[92px]"
                  />
                ) : null}
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={listening ? "Listening…" : "Ask your coach anything…"}
                  className="flex-1 min-w-0 bg-transparent text-sm text-primary placeholder:text-black/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={listening ? stopDictation : startDictation}
                  disabled={!dictationSupported || micStatus === "denied"}
                  aria-pressed={listening}
                  aria-label={listening ? "Stop dictating" : "Dictate your message"}
                  title={
                    micStatus === "denied"
                      ? "Mic blocked — type instead"
                      : !dictationSupported
                        ? "Dictation needs Chrome or Edge"
                        : listening
                          ? "Stop dictating"
                          : "Dictate"
                  }
                  className={cn(
                    "inline-flex h-8 w-8 flex-none items-center justify-center rounded-md cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none",
                    listening ? "bg-[#222325] text-[#e1f073]" : "text-black/45 hover:bg-black/5 hover:text-primary"
                  )}>
                  {micStatus === "requesting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send"
                title="Send"
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border-[1.5px] border-[#222325] bg-[#222325] text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30 disabled:pointer-events-none">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </DashCard>
        </div>
      </main>
    </div>
  );
};

export default CoachClient;
