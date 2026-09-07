// The follow-up engine.
//
// `logApplication` has always promised "Follow-up reminder set for the 14th"
// and then done nothing with it — the date was computed, shown once in the
// payoff panel, and dropped. This module is what makes that promise true.
//
// Everything here is pure and derived from the board: an application's silence
// is the gap since anything last happened to it, which the tracker card
// already records. Nothing is scheduled and nothing is stored, so a nudge can
// never be stale — close the card or move it and the nudge disappears on the
// next render.
//
// Drafting follows the house style of `resume/ai-tools.ts`: deterministic
// transforms over what we already know, no model call, same input → same text.
// A real generator replaces `draftFollowUp` one-for-one; the signature is the
// contract.

import type { TrackerCard, TrackerColumnId } from "./types";

/**
 * Days after applying before a nudge is due. Exported because
 * `ActivityProvider.logApplication` computes the same promise from it — two
 * copies of "7" would drift the moment either was tuned.
 */
export const FOLLOW_UP_AFTER_APPLY_DAYS = 7;

/** Mid-conversation silence runs on a shorter fuse than a cold application. */
export const FOLLOW_UP_IN_PLAY_DAYS = 5;

/** Past this, silence is the story rather than the prompt. */
export const FOLLOW_UP_ESCALATE_DAYS = 14;

export type FollowUpKind = "after-apply" | "in-play" | "long-silence";

export interface FollowUpDue {
  cardId: string;
  kind: FollowUpKind;
  daysSilent: number;
  company: string;
  role: string;
  columnId: TrackerColumnId;
}

/** How each kind is introduced to the user — the reason, not the instruction. */
export const FOLLOW_UP_REASON: Record<FollowUpKind, string> = {
  "after-apply": "A week of silence is normal. A short nudge isn't pushy.",
  "in-play": "You're mid-conversation — going quiet now costs you the momentum.",
  "long-silence": "Two weeks out. One last note, then let it go.",
};

/**
 * Days since anything happened to this application. Mirrors
 * `tracker-meta.daysSinceTouch`, redeclared here so this module stays free of
 * component imports — it is pure data logic and has to be testable alone.
 */
function silenceOf(card: TrackerCard): number | null {
  return card.lastTouchedDaysAgo ?? card.daysAgo ?? null;
}

/**
 * Which stages can even owe a follow-up.
 *
 * `saved` can't — nobody owes a reply to an application you haven't sent.
 * `offer` can't either: silence there is the user's own move to make, and the
 * right prompt is the win log, not a nudge.
 */
function stageCanNudge(columnId: TrackerColumnId): boolean {
  return columnId === "applied" || columnId === "conversation" || columnId === "interviewing";
}

/**
 * The one nudge this card is owed, or null.
 *
 * Capped at `ghostAfterDays`: past that the board already offers to close the
 * card as ghosted, and showing both would have the app simultaneously advising
 * "chase this" and "this is dead". The ghost prompt wins, because at six weeks
 * it's the more honest of the two.
 */
export function followUpFor(card: TrackerCard, columnId: TrackerColumnId, ghostAfterDays: number): FollowUpDue | null {
  if (!stageCanNudge(columnId)) return null;
  const daysSilent = silenceOf(card);
  if (daysSilent === null || daysSilent >= ghostAfterDays) return null;

  const threshold = columnId === "applied" ? FOLLOW_UP_AFTER_APPLY_DAYS : FOLLOW_UP_IN_PLAY_DAYS;
  if (daysSilent < threshold) return null;

  const kind: FollowUpKind =
    daysSilent >= FOLLOW_UP_ESCALATE_DAYS ? "long-silence" : columnId === "applied" ? "after-apply" : "in-play";

  return { cardId: card.id, kind, daysSilent, company: card.company, role: card.title, columnId };
}

/** Every open application owed a nudge, longest silence first. */
export function dueFollowUps(
  placed: { card: TrackerCard; columnId: TrackerColumnId }[],
  ghostAfterDays: number,
): FollowUpDue[] {
  return placed
    .map(({ card, columnId }) => followUpFor(card, columnId, ghostAfterDays))
    .filter((d): d is FollowUpDue => d !== null)
    .sort((a, b) => b.daysSilent - a.daysSilent);
}

/**
 * The message itself. Short on purpose — the evidence that follow-ups work is
 * that they're brief, specific and easy to reply to, and a long one reads as
 * an apology for existing.
 */
export function draftFollowUp(due: FollowUpDue, senderFirstName: string): string {
  const sign = `\n\nThanks,\n${senderFirstName}`;

  if (due.kind === "after-apply") {
    return (
      `Hi,\n\n` +
      `I applied for the ${due.role} role at ${due.company} ${due.daysSilent} days ago and wanted to put my name in front of you once more.\n\n` +
      `I'm still very interested — happy to send anything that would help, or to answer questions about my work.` +
      sign
    );
  }

  if (due.kind === "in-play") {
    return (
      `Hi,\n\n` +
      `Following up on the ${due.role} conversation at ${due.company}. It's been ${due.daysSilent} days and I didn't want it to go quiet on my side.\n\n` +
      `Is there anything you need from me to keep things moving?` +
      sign
    );
  }

  return (
    `Hi,\n\n` +
    `Checking in one last time on the ${due.role} role at ${due.company} — it's been about ${due.daysSilent} days.\n\n` +
    `If the search has moved on, no problem at all, and I'd appreciate knowing so I can close it out on my end.` +
    sign
  );
}
