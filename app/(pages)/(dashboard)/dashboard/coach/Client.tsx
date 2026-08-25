"use client";

import { FC, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import { COACH_MESSAGES, COACH_PLAN, COACH_SESSIONS } from "@/app/lib/dashboard/mock-data";
import type { CoachMessage, CoachPlanItem } from "@/app/lib/dashboard/types";

// ---------------------------------------------------------------------------
// Local content that isn't shared with any other screen — the canned coach
// replies used when the composer "sends" a message. No real AI call; this is
// a static, cycling set of plausible coaching responses.
// ---------------------------------------------------------------------------

const CANNED_REPLIES: string[] = [
  "That's a fair read. Let's test it — lead with the async angle on two more applications this week and see if reply speed changes.",
  "I'd hold off rewriting your resume over one data point. Give it another week before we call it a pattern.",
  "Good instinct — add a line about that to your next cover letter, and I'll check the reply rate again on Friday.",
  "Worth asking directly rather than guessing. Recruiters usually answer that one honestly if you just raise it in the screen.",
  "That lines up with what I'm seeing across your pod, too — it's not just you.",
];

let messageSeq = 0;
function nextMessageId(prefix: string) {
  messageSeq += 1;
  return `${prefix}-${Date.now()}-${messageSeq}`;
}

const CoachClient: FC = () => {
  const [messages, setMessages] = useState<CoachMessage[]>(COACH_MESSAGES);
  const [draft, setDraft] = useState("");
  const [planItems, setPlanItems] = useState<CoachPlanItem[]>(COACH_PLAN);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [replyIndex, setReplyIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const planDone = planItems.filter((p) => p.done).length;

  const togglePlanItem = (id: string) => {
    setPlanItems((prev) => prev.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
  };

  const handleNewSession = () => {
    setMessages(COACH_MESSAGES);
    setDraft("");
    setActiveSessionId(null);
    setReplyIndex(0);
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const userMsg: CoachMessage = { id: nextMessageId("msg-user"), from: "user", text };
    const reply: CoachMessage = {
      id: nextMessageId("msg-coach"),
      from: "coach",
      text: CANNED_REPLIES[replyIndex % CANNED_REPLIES.length],
    };

    setMessages((prev) => [...prev, userMsg, reply]);
    setReplyIndex((i) => i + 1);
    setDraft("");
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 flex-none rounded-full bg-secondary text-primary font-extrabold text-xs flex items-center justify-center">
            RW
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold text-primary leading-tight truncate">Career coach</h1>
            <p className="text-xs text-black/45 truncate">Knows your profile, applications and results</p>
          </div>
        </div>
        <StickerButton variant="primary" size="md" onClick={handleNewSession} className="flex-none">
          <RotateCcw className="h-4 w-4" />
          New session
        </StickerButton>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1100px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
          {/* Chat column */}
          <DashCard className="p-0 flex flex-col overflow-hidden h-[calc(100vh-200px)] min-h-[480px]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex gap-2.5 items-start", m.from === "user" && "justify-end")}>
                  {m.from === "coach" && (
                    <div className="h-7 w-7 flex-none rounded-full bg-secondary text-primary font-extrabold text-[10px] flex items-center justify-center mt-0.5">
                      RW
                    </div>
                  )}
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
            </div>

            {/* Sticky bottom composer */}
            <form onSubmit={handleSend} className="flex-none border-t border-black/10 p-4 flex items-center gap-3 bg-white">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask your coach anything…"
                className="flex-1 h-11 rounded-lg border border-black/12 bg-[#f6f6f6] px-4 text-sm text-primary placeholder:text-black/40 focus:outline-none focus:border-black/30 transition-colors"
              />
              <StickerButton type="submit" variant="primary" size="md" className="flex-none" disabled={!draft.trim()}>
                <Send className="h-4 w-4" />
                Send
              </StickerButton>
            </form>
          </DashCard>

          {/* Right rail */}
          <div className="flex flex-col gap-5">
            {/* This month's plan */}
            <DashCard className="p-5">
              <div className="flex items-center justify-between mb-3.5">
                <p className="text-sm font-bold text-primary">This month&apos;s plan</p>
                <span className="text-xs font-medium text-black/45">
                  {planDone} of {planItems.length} done
                </span>
              </div>
              <div className="flex flex-col gap-1 -mx-1.5">
                {planItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePlanItem(item.id)}
                    className="group flex items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-[#f6f6f6] transition-colors cursor-pointer text-left">
                    <NeoCheckbox checked={item.done} />
                    <span className={cn("text-sm", item.done ? "text-black/40 line-through" : "text-primary font-medium")}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </DashCard>

            {/* Past sessions */}
            <DashCard className="p-5">
              <p className="text-sm font-bold text-primary mb-3.5">Past sessions</p>
              <div className="flex flex-col gap-1 -mx-1.5">
                {COACH_SESSIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSessionId(s.id)}
                    className={cn(
                      "text-left rounded-lg px-2.5 py-2.5 text-sm transition-colors cursor-pointer",
                      activeSessionId === s.id ? "bg-[#222325] text-white font-semibold" : "text-black/70 font-medium hover:bg-[#f6f6f6]"
                    )}>
                    {s.title}
                  </button>
                ))}
              </div>
            </DashCard>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CoachClient;
