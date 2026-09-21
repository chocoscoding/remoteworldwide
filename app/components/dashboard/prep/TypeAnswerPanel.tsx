"use client";

// Typing, during a spoken interview.
//
// The interview is a conversation, so the keyboard is deliberately not on
// screen: it is one icon that opens a composer. Typing still goes into the
// SAME live session — `sendUserMessage` hands text to the agent and it answers
// out loud — so nothing is being switched off and nothing has to be restarted.
//
// The confirmation is not about that, though, and it should not pretend to be.
// The delivery report — pace, filler words, pauses — is measured from the
// candidate's own speech. An answer that is typed produces no speech, so that
// answer is simply absent from the scoring. That is the cost worth stopping
// someone for, and it is the one the dialog names. It is asked once per
// session, because a person who has accepted it does not need telling again
// every time they reach for the keyboard.

import { useEffect, useRef, useState, type FC, type FormEvent } from "react";
import { Keyboard, Loader2, SendHorizonal, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";

export interface TypeAnswerPanelProps {
  /** Send typed text into the live conversation. Resolves when it has gone. */
  onSend: (text: string) => Promise<void> | void;
  /** Hidden while the session is not able to take an answer. */
  disabled?: boolean;
  /** Label on the send button. The interview advances rather than "sends". */
  sendLabel?: string;
  /** A quiet line beside the icon, for the hint the composer used to carry. */
  hint?: string;
  /** The surface it sits on. The live interview screen is dark. */
  tone?: "light" | "dark";
  className?: string;
}

const TypeAnswerPanel: FC<TypeAnswerPanelProps> = ({ onSend, disabled, sendLabel, hint, tone = "light", className }) => {
  const dark = tone === "dark";
  const [confirming, setConfirming] = useState(false);
  // Once per session, not once per use — see the header.
  const [accepted, setAccepted] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const requestOpen = () => {
    if (accepted) {
      setOpen(true);
      return;
    }
    setConfirming(true);
  };

  const accept = () => {
    setAccepted(true);
    setConfirming(false);
    setOpen(true);
  };

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSend(value);
      // Cleared only once it has gone: a failed send should not also cost them
      // what they wrote.
      setText("");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  if (!open) {
    return (
      // The wrapper carries `className`, not the button: callers pass layout
      // classes like `flex-1`, and on the button that stretches a 44px round
      // icon into a pill.
      <div className={cn("flex items-center gap-3", className)}>
        <button
          type="button"
          onClick={requestOpen}
          disabled={disabled}
          aria-label="Type your answer instead"
          title="Type your answer instead"
          className={cn(
            "grid h-11 w-11 flex-none place-content-center rounded-full border-[1.5px] transition-[transform,box-shadow] duration-100 ease-out",
            dark
              ? "border-white/20 text-white hover:border-white/45"
              : "border-[#222325] bg-white text-primary shadow-[3px_3px_0_0_#222325] hover:shadow-[4px_4px_0_0_#222325] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
            "disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
          )}>
          <Keyboard className="h-4 w-4" />
        </button>
        {hint && <span className={cn("text-xs", dark ? "text-white/35" : "text-black/45")}>{hint}</span>}

        <Dialog open={confirming} onOpenChange={setConfirming}>
          {/* `bg-white` explicitly, as every dialog here does: the shared
              DialogContent's `bg-background` resolves to `hsl(#f6f6f6)`, which
              is not valid CSS, so the default is a transparent panel. */}
          <DialogContent className="max-w-[420px] gap-0 rounded-[20px] border-2 border-[#222325] bg-white p-6">
            <DialogTitle className="text-base font-bold text-primary">Type this answer instead?</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-black/60">
              You can keep going in the same conversation — the interviewer will read what you type and reply out loud.
              <br />
              <br />
              What you type <strong className="font-bold text-primary">won&apos;t be scored for delivery</strong>. Pace, filler words
              and pauses are measured from your voice, so a typed answer is left out of that part of your report.
            </DialogDescription>
            <div className="mt-4 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="cursor-pointer text-sm font-bold text-black/50 underline decoration-2 underline-offset-2">
                Keep speaking
              </button>
              <StickerButton type="button" variant="primary" size="md" onClick={accept}>
                <Keyboard className="h-4 w-4" />
                Let me type
              </StickerButton>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex items-end gap-2 rounded-xl border p-2",
        dark ? "border-white/15 bg-white/5" : "border-[1.5px] border-[#222325] bg-white shadow-[3px_3px_0_0_#222325]",
        className
      )}>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter breaks the line — the interview is a
          // conversation, and an answer is usually one stretch of prose.
          if (e.key === "Enter" && !e.shiftKey) void submit(e as unknown as FormEvent);
        }}
        rows={1}
        placeholder="Type your answer…"
        className={cn(
          "min-h-[38px] max-h-[120px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none",
          dark ? "text-white placeholder:text-white/25" : "text-primary placeholder:text-black/35"
        )}
      />
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setText("");
        }}
        aria-label="Close and go back to speaking"
        title="Back to speaking"
        className={cn(
          "grid h-9 w-9 flex-none place-content-center rounded-lg cursor-pointer",
          dark ? "text-white/40 hover:bg-white/10 hover:text-white" : "text-black/40 hover:bg-[#f0f0ea] hover:text-primary"
        )}>
        <X className="h-4 w-4" />
      </button>
      <button
        type="submit"
        disabled={!text.trim() || sending}
        aria-label={sendLabel ?? "Send answer"}
        className={cn(
          "inline-flex h-9 flex-none cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-[#222325] bg-[#e1f073] font-bold text-[#222325] disabled:pointer-events-none disabled:opacity-40",
          sendLabel ? "px-3.5 text-sm" : "w-9 justify-center"
        )}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
        {sendLabel}
      </button>
    </form>
  );
};

export default TypeAnswerPanel;
