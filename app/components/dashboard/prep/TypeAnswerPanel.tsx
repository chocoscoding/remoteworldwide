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
// every time they reach for the keyboard. An unsaved session turns it off
// (`confirm={false}`): nothing is recorded there and nothing is scored for
// delivery, so there is no cost to warn about.
//
// The composer keeps its own text where the caller has none of its own to
// keep — a live conversation takes the typed line and answers it. Where the
// caller already holds the answer, because it is being dictated into as well,
// it passes `value`/`onValueChange` and the composer edits that instead: one
// buffer, so typing adds to what was said rather than replacing it.

import { useEffect, useRef, useState, type FC, type FormEvent, type ReactNode } from "react";
import { Keyboard, Loader2, SendHorizonal, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";

export interface TypeAnswerPanelProps {
  /** Send typed text into the live conversation. Resolves when it has gone; `false` says it did not, and the text stays. */
  onSend: (text: string) => Promise<boolean | void> | boolean | void;
  /** Hidden while the session is not able to take an answer. */
  disabled?: boolean;
  /** Label on the send button. The interview advances rather than "sends". */
  sendLabel?: string;
  /** A quiet line beside the icon, for the hint the composer used to carry. */
  hint?: string;
  /**
   * Shown right after the icon while the composer is closed: the live
   * interview puts the candidate's voice meter here. Typing replaces it, as
   * the composer replaces the icon.
   */
  beside?: ReactNode;
  /** The surface it sits on. The live interview screen is dark. */
  tone?: "light" | "dark";
  /** Each keystroke in the composer, so a live interviewer can hold off while the answer is written. */
  onTyping?: () => void;
  /**
   * Whether to ask before the composer opens. False where the dialog's premise
   * does not hold: an unsaved session records nothing and is never scored for
   * delivery, so warning that a typed answer is left out of that scoring would
   * simply be untrue.
   */
  confirm?: boolean;
  /** Open from the start, where typing is the only way in: no dictation in this browser, or a blocked mic. */
  defaultOpen?: boolean;
  /**
   * The composer's text, where the caller owns it. An unsaved interview keeps
   * one buffer for the whole answer — what is dictated and what is typed are
   * the same answer, and it is the caller that sends them — so the composer
   * edits that buffer rather than a second one beside it. Without this the
   * panel keeps its own, and a typed line is sent on its own.
   */
  value?: string;
  onValueChange?: (text: string) => void;
  /**
   * The composer opened or closed (and closed on unmount). A screen that sends
   * a spoken answer on silence holds off while it is open: the candidate is
   * writing, and stopping to choose a word is not the end of their answer.
   */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const TypeAnswerPanel: FC<TypeAnswerPanelProps> = ({
  onSend,
  disabled,
  sendLabel,
  hint,
  beside,
  tone = "light",
  onTyping,
  confirm = true,
  defaultOpen = false,
  value,
  onValueChange,
  onOpenChange,
  className,
}) => {
  const dark = tone === "dark";
  const [confirming, setConfirming] = useState(false);
  // Once per session, not once per use — see the header.
  const [accepted, setAccepted] = useState(!confirm);
  const [opened, setOpened] = useState(defaultOpen);
  // `defaultOpen` can turn true well after this mounts — the answer bar goes up
  // while the mic prompt is still on screen, and only lands on "denied" when it
  // is answered — so it opens the composer whenever it becomes true, not only
  // at mount. Derived rather than set from an effect, and closing still sticks.
  const [dismissed, setDismissed] = useState(false);
  const open = opened || (defaultOpen && !dismissed);
  const [ownText, setOwnText] = useState("");
  const owned = value !== undefined;
  const text = owned ? value : ownText;
  const setText = (next: string) => (owned ? onValueChange?.(next) : setOwnText(next));
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Said from an effect because `open` is partly derived (defaultOpen), and so
  // the caller also hears it close when the panel goes away mid-answer.
  useEffect(() => {
    onOpenChange?.(open);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);

  const requestOpen = () => {
    if (accepted) {
      setOpened(true);
      setDismissed(false);
      return;
    }
    setConfirming(true);
  };

  const accept = () => {
    setAccepted(true);
    setConfirming(false);
    setOpened(true);
    setDismissed(false);
  };

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const answer = text.trim();
    if (!answer || sending) return;
    setSending(true);
    try {
      // Cleared only once it has gone: a failed send, or one the session was
      // not ready for, should not also cost them what they wrote.
      if ((await onSend(answer)) === false) return;
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
        {beside}
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
    // The wrapper carries `className` here too, so the hint sits under the
    // composer rather than beside the icon. It has to survive the panel being
    // open: `defaultOpen` opens it for a blocked mic and for a browser without
    // recognition, and the hint is the only place either is explained.
    <div className={cn("flex flex-col gap-1", className)}>
      <form
        onSubmit={submit}
        className={cn(
          "flex items-end gap-2 rounded-xl border p-2",
          dark ? "border-white/15 bg-white/5" : "border-[1.5px] border-[#222325] bg-white shadow-[3px_3px_0_0_#222325]"
        )}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping?.();
          }}
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
            setOpened(false);
            setDismissed(true);
            // A caller-owned buffer is the answer itself, still being dictated
            // into: putting the keyboard away is not throwing the answer away.
            // The panel's own text is a typed answer nobody sent, and that does go.
            if (!owned) setOwnText("");
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
      {hint && <span className={cn("px-1 text-xs", dark ? "text-white/35" : "text-black/45")}>{hint}</span>}
    </div>
  );
};

export default TypeAnswerPanel;
