"use client";

import { useId, useRef, useState, type FC, type FocusEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import type { AnswerNote } from "@/app/components/dashboard/prep/report/answerNotes";

/**
 * A phrase in the transcript the analysis left a note on: underlined, and on
 * hover, keyboard focus or a tap it turns lime and a card under it says what
 * the note is, what to say instead and why.
 *
 * The phrase stays running text, so it wraps like the words around it and a
 * screen reader reads it in line. It is a button (Tab reaches it; Enter plays
 * the recording from it, or keeps the card open when there is nothing to
 * play) and carries the note as its description. The card itself is for the
 * eye only: the description already says everything on it.
 *
 * Words inside keep their own click to play, which the transcript handles.
 */
export interface TranscriptNoteProps {
  note: AnswerNote;
  /** Plays the recording from the phrase; null when there is nothing to play. */
  onPlay: (() => void) | null;
  children: ReactNode;
}

/** How long the pointer may cross the gap between the phrase and the card before it closes. */
const HOVER_CLOSE_MS = 150;

/** Focus from the keyboard, not the focus a click or tap leaves behind. */
const isKeyboardFocus = (el: Element) => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
};

const TranscriptNote: FC<TranscriptNoteProps> = ({ note, onPlay, children }) => {
  // Open while any one holds it: the pointer over it, the keyboard on it, or a tap that pinned it.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  const descriptionId = useId();
  const phraseRef = useRef<HTMLSpanElement | null>(null);
  const pointerRef = useRef("mouse");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stay = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const leaveSoon = () => {
    stay();
    closeTimer.current = setTimeout(() => setHovered(false), HOVER_CLOSE_MS);
  };
  const close = () => {
    stay();
    setHovered(false);
    setFocused(false);
    setPinned(false);
  };

  const onPointerEnter = (e: PointerEvent) => {
    pointerRef.current = e.pointerType;
    if (e.pointerType !== "mouse") return;
    stay();
    setHovered(true);
  };
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") leaveSoon();
  };

  // A mouse already sees the card on hover, and its click plays the word under
  // it. A tap has no hover, so it pins the card (and still plays the word).
  const onClick = () => {
    if (pointerRef.current !== "mouse" || !onPlay) setPinned((was) => !was);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onPlay) onPlay();
      else setPinned((was) => !was);
    } else if (e.key === "Escape" && open) {
      close();
    }
  };

  const onFocus = (e: FocusEvent<HTMLSpanElement>) => {
    if (isKeyboardFocus(e.currentTarget)) setFocused(true);
  };

  const description = [`Note: ${note.label}.`, note.sayInstead ? `Say instead: ${note.sayInstead}.` : "", note.tip ?? ""].filter(Boolean).join(" ");

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(next) => !next && close()}>
      <PopoverPrimitive.Anchor asChild>
        <span
          ref={phraseRef}
          role="button"
          tabIndex={0}
          aria-describedby={descriptionId}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onPointerDown={(e) => {
            pointerRef.current = e.pointerType;
          }}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={() => setFocused(false)}
          className={cn(
            "cursor-pointer rounded-[4px] py-[2px] underline decoration-[#222325] decoration-[1.5px] underline-offset-[5px] transition-colors box-decoration-clone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#222325]",
            open && "bg-[#e1f073]"
          )}>
          {children}
        </span>
      </PopoverPrimitive.Anchor>
      <span id={descriptionId} hidden>
        {description}
      </span>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          // The phrase's description says all of this; the card is what the eye gets.
          aria-hidden
          // Focus stays on the phrase, and is never pulled back to it on close.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // Pressing the phrase itself (a word in it, to play) isn't "outside".
          onInteractOutside={(e) => {
            if (e.target instanceof Node && phraseRef.current?.contains(e.target)) e.preventDefault();
          }}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") stay();
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") leaveSoon();
          }}
          className="br-bold z-50 w-[min(360px,calc(100vw-32px))] rounded-xl bg-white p-3.5 text-[#222325] outline-none">
          <span className="inline-flex rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-bold">{note.label}</span>
          {note.sayInstead && (
            <>
              <p className="mt-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Say instead</p>
              <p className="mt-0.5 text-[13.5px] font-bold leading-snug">{note.sayInstead}</p>
            </>
          )}
          {note.tip && <p className="mt-2 text-xs leading-relaxed text-black/50">{note.tip}</p>}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};

export default TranscriptNote;
