"use client";

import { FC, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, Copy, Linkedin, Share2, Trophy, Twitter, UsersRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import { useSettings } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import { useApplications } from "@/hooks/queries/useApplicationsQuery";
import { usePodOverview } from "@/hooks/queries/usePodQuery";
import { useInviteLink, useInviteSummary } from "@/hooks/queries/useInviteSummary";
import { useSharePost } from "@/hooks/mutations/usePodMutations";
import { firstNameOf, trackedLink } from "@/app/lib/dashboard/win";
import type { ApplicationItem } from "@/app/lib/applications/types";

/**
 * "Share a win" — an interview or an offer from the user's own tracker, told
 * to their pod and their network.
 *
 * Everything on it is real: the win is an application on the tracker (the
 * furthest-along one unless the caller names another), the name is the
 * settings profile's, the faces are the pod's actual members, and the link in
 * every caption is the user's own invite link, so a signup from a shared win
 * is credited to them.
 *
 * And nothing on it claims more than happened. A pod post says "Posted" only
 * after the server stored it. LinkedIn and X can't tell us whether a post went
 * out, so opening their composer is "Opened". The native share sheet resolving
 * means the user picked a target, which is the one moment "Shared" is true.
 *
 * Distinct from WinCelebrationDialog, which is the "I got the job" moment with
 * a drawn card; this is the lighter, earlier news — a loop booked, an offer in.
 */
export type ShareWinTier = "Interview" | "Offer";

export interface ShareWinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselects this application; otherwise the furthest-along win on the tracker. */
  applicationId?: string;
}

interface ShareableWin {
  id: string;
  company: string;
  role: string;
  tier: ShareWinTier;
}

interface TierStyle {
  title: string;
  /** Leads the caption: first person, present tense, no name — it's their post. */
  headline: string;
  /** The pod post's verb. The feed prints no author, so the post names its own. */
  podVerb: string;
  badgeBg: string;
  badgeText: string;
}

// Full literal Tailwind classes per key (not built from template strings) so
// every class is visible to Tailwind's static build-time scan — same
// convention as StickerButton's STICKER_SHADOW_HOVER map.
const TIER_STYLES: Record<ShareWinTier, TierStyle> = {
  Interview: { title: "Interview booked", headline: "Interview booked", podVerb: "booked an interview", badgeBg: "bg-[#e1f073]", badgeText: "text-[#222325]" },
  Offer: { title: "Offer received", headline: "Offer in", podVerb: "got an offer", badgeBg: "bg-[#f0c86a]", badgeText: "text-[#222325]" },
};

/**
 * Open applications at a stage that is news: offers first, then the most
 * recently touched. Closed rows are out — a rejection after the loop is not
 * something anyone shares as a win.
 */
function shareableWins(rows: readonly ApplicationItem[]): ShareableWin[] {
  return rows
    .filter((row) => row.status === "offer" || row.status === "interviewing")
    .sort((a, b) => (a.status === b.status ? b.lastTouchedAt.localeCompare(a.lastTouchedAt) : a.status === "offer" ? -1 : 1))
    .map((row) => ({ id: row.id, company: row.company, role: row.role, tier: row.status === "offer" ? "Offer" : "Interview" }));
}

type Channel = "pod" | "linkedin" | "x" | "native" | "copy";
type Outcome = "posted" | "opened" | "shared" | "copied";

const OUTCOME_LABEL: Record<Outcome, string> = { posted: "Posted", opened: "Opened", shared: "Shared", copied: "Copied" };

const CONFETTI_COLORS = ["bg-[#e1f073]", "bg-[#f0c86a]", "bg-[#cddd54]", "bg-[#222325]", "bg-white"];
const CONFETTI_SIZES = ["h-1.5 w-1.5", "h-2 w-1", "h-1 w-2.5", "h-2 w-2"];
const CONFETTI_COUNT = 24;
// Falls the full height of the card before the overlay clips it — comfortably
// taller than this modal ever renders at `max-w-md`.
const CONFETTI_FALL_DISTANCE = 620;
/** How many other members' faces the pod row shows before "+N". */
const FACES_SHOWN = 4;

interface ConfettiPiece {
  id: number;
  left: number;
  colorClass: string;
  sizeClass: string;
  rotate: number;
  duration: number;
  delay: number;
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 100),
    colorClass: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    sizeClass: CONFETTI_SIZES[Math.floor(Math.random() * CONFETTI_SIZES.length)],
    rotate: Math.round((Math.random() - 0.5) * 540),
    duration: 1.6 + Math.random() * 1.4,
    delay: Math.random() * 0.55,
  }));
}

const ShareWinModal: FC<ShareWinModalProps> = ({ open, onOpenChange, applicationId }) => {
  const { profile } = useSettings();
  const name = profile.fullName.trim();
  const applications = useApplications({ enabled: open });
  // Only asked for while open: whether there is a pod to post to, and who is in it.
  const podQuery = usePodOverview({ enabled: open });
  const inviteLink = useInviteLink();
  const invites = useInviteSummary();
  const sharePost = useSharePost();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hideCompany, setHideCompany] = useState(false);
  const [outcomes, setOutcomes] = useState<Partial<Record<Channel, Outcome>>>({});

  // Recomputed every time the modal opens so the burst looks fresh each time,
  // rather than replaying the exact same positions.
  const confetti = useMemo(() => (open ? makeConfetti() : []), [open]);

  // Reset transient UI state once the dialog closes. Adjusting state during
  // render off a tracked previous value — rather than in a useEffect — is the
  // pattern React recommends for "reset state when a prop changes".
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setSelectedId(null);
      setHideCompany(false);
      setOutcomes({});
    }
  }

  const wins = useMemo(() => shareableWins(applications.data ?? []), [applications.data]);
  const win = wins.find((w) => w.id === (selectedId ?? applicationId)) ?? wins[0] ?? null;
  const style = win ? TIER_STYLES[win.tier] : null;
  const where = win ? (hideCompany ? win.role : `${win.role} at ${win.company}`) : "";

  const pod = podQuery.data?.pod ?? null;
  const others = (podQuery.data?.members ?? []).filter((m) => !m.me);

  // Per-platform attribution on the link; the preview shows it clean.
  const caption = (utmSource?: string) =>
    style
      ? `${style.headline} \u{1F389} ${where}. I'm tracking my remote job search on Remote Worldwide — if you're searching too: ${trackedLink(inviteLink.url, utmSource, "winshare")}`
      : "";

  const mark = (channel: Channel, outcome: Outcome) => setOutcomes((prev) => ({ ...prev, [channel]: outcome }));

  function pickWin(id: string) {
    setSelectedId(id);
    // A different win is a different post: nothing about it has gone anywhere yet.
    setOutcomes({});
  }

  function postToPod() {
    if (!style) return;
    // What's moving shows the others no author, so the post carries the
    // profile's first name — without it the pod would read an anonymous win.
    const text = name ? `${firstNameOf(name)} ${style.podVerb} — ${where} \u{1F389}` : `${style.title} — ${where} \u{1F389}`;
    // The toast comes from useSharePost, on the server's answer — as does the
    // refusal, if the pod turns out to be gone.
    sharePost.mutate({ text, hot: true }, { onSuccess: () => mark("pod", "posted") });
  }

  /**
   * Opens a composer in a new tab. The clipboard write is started first and
   * not awaited: window.open has to run inside the click's user activation, or
   * Safari blocks the tab. The toast waits for the write, so it only says
   * "copied" when the copy happened.
   */
  function openComposer(channel: "linkedin" | "x", label: string, url: string, copyText: string | null, postHint: string) {
    const copy = copyText && typeof navigator !== "undefined" && navigator.clipboard ? navigator.clipboard.writeText(copyText) : null;
    window.open(url, "_blank", "noopener,noreferrer");
    mark(channel, "opened");
    if (!copy) {
      toast.success(`Opened ${label}`, { description: postHint });
      return;
    }
    copy.then(
      () => toast.success(`Opened ${label}`, { description: `Your caption is copied. ${postHint}` }),
      () => toast.success(`Opened ${label}`, { description: `Copy the caption from here, then ${postHint.charAt(0).toLowerCase()}${postHint.slice(1)}` }),
    );
  }

  function shareLinkedIn() {
    // share-offsite takes a URL and nothing else, so the words go via the clipboard.
    const link = trackedLink(inviteLink.url, "linkedin", "winshare");
    openComposer(
      "linkedin",
      "LinkedIn",
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
      caption("linkedin"),
      "Paste it above the link and press Post on LinkedIn.",
    );
  }

  function shareX() {
    openComposer(
      "x",
      "X",
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption("x"))}`,
      null,
      "Your post is written — press Post on X to share it.",
    );
  }

  async function shareNative() {
    try {
      await navigator.share({ title: name ? `${name} — ${style?.title ?? "a win"}` : (style?.title ?? "A win"), text: caption("share") });
      mark("native", "shared");
      toast.success("Shared");
    } catch (error) {
      // Closing the sheet is a decision, not an error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Your share sheet didn't open", { description: "Copy the caption instead and paste it wherever you like." });
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption("copy"));
      mark("copy", "copied");
    } catch {
      toast.error("Couldn't copy that", { description: "Select the caption and copy it yourself." });
    }
  }

  // Read at render, not in an effect: the dialog content only exists client
  // side (it mounts on the user's click), so there is no server markup to match.
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const targets: { id: Channel; label: string; icon: LucideIcon; onClick: () => void }[] = [
    { id: "linkedin", label: "LinkedIn", icon: Linkedin, onClick: shareLinkedIn },
    { id: "x", label: "X", icon: Twitter, onClick: shareX },
    ...(canNativeShare ? [{ id: "native" as const, label: "More…", icon: Share2, onClick: () => void shareNative() }] : []),
    { id: "copy", label: "Copy caption", icon: Copy, onClick: () => void copyCaption() },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-[20px] border-0 p-0 max-w-md overflow-hidden">
        <DialogTitle className="sr-only">{style?.title ?? "Share a win"}</DialogTitle>
        <DialogDescription className="sr-only">Share this win with your pod or your network.</DialogDescription>

        <div className="relative max-h-[92vh] overflow-y-auto">
          {/* Confetti layer — falls over the whole card, clipped by overflow-hidden above */}
          {win && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {confetti.map((p) => (
                <motion.span
                  key={p.id}
                  className={cn("absolute top-0 block rounded-[1px]", p.colorClass, p.sizeClass)}
                  style={{ left: `${p.left}%` }}
                  initial={{ y: -24, rotate: 0, opacity: 0 }}
                  animate={{ y: CONFETTI_FALL_DISTANCE, rotate: p.rotate, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
                />
              ))}
            </div>
          )}

          {!win ? (
            <div className="relative px-6 pt-10 pb-7 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 bg-[#f0f0ea]">
                <Trophy className="h-7 w-7 text-black/40" />
              </div>
              {applications.isPending ? (
                <p className="text-sm text-black/55">Loading your tracker…</p>
              ) : (
                <>
                  <p className="text-lg font-bold text-primary">Nothing to share yet</p>
                  <p className="text-sm text-black/55 mt-1 max-w-[300px]">
                    Move an application to Interviewing or Offer on your tracker and it shows up here, ready to share.
                  </p>
                  <Link
                    href="/dashboard/tracker"
                    onClick={() => onOpenChange(false)}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                    Open your tracker
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="relative px-6 pt-9 pb-6 flex flex-col items-center text-center">
              {/* Tier-branded trophy panel */}
              <motion.div
                key={win.id}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.1 }}
                className={cn("h-16 w-16 rounded-2xl flex items-center justify-center mb-4", TIER_STYLES[win.tier].badgeBg)}>
                <Trophy className={cn("h-7 w-7", TIER_STYLES[win.tier].badgeText)} />
              </motion.div>

              <p className="text-lg font-bold text-primary">{TIER_STYLES[win.tier].title}</p>
              <p className="text-sm text-black/55 mt-1">
                {win.role} at {win.company}
              </p>

              {/* More than one win on the board: let them choose which one this is. */}
              {wins.length > 1 && (
                <>
                  <label htmlFor="share-win-pick" className="sr-only">
                    Which win to share
                  </label>
                  <select
                    id="share-win-pick"
                    value={win.id}
                    onChange={(e) => pickWin(e.target.value)}
                    className="mt-3 w-full cursor-pointer rounded-lg border border-black/12 bg-white px-3 py-2 text-xs font-semibold text-primary outline-none focus:border-[#222325]">
                    {wins.map((w) => (
                      <option key={w.id} value={w.id}>
                        {TIER_STYLES[w.tier].title} — {w.role} at {w.company}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* Caption preview — exactly what the copy and the composers carry. */}
              <div className="mt-5 w-full rounded-xl border border-black/10 bg-[#fbfbf7] px-4 py-3 text-left">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Your caption</p>
                  <button
                    type="button"
                    aria-pressed={hideCompany}
                    onClick={() => setHideCompany((v) => !v)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
                      hideCompany ? "border-[#222325] bg-[#222325] text-white" : "border-black/20 text-black/60 hover:border-black/40",
                    )}>
                    {hideCompany && <Check className="h-3 w-3" />}
                    {hideCompany ? "Company hidden" : "Hide company"}
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-black/70 break-words">{caption()}</p>
              </div>

              {/* The pod — the people who actually cheer. Real members, real post. */}
              <div className="mt-4 w-full rounded-xl border border-black/10 px-4 py-3 text-left">
                {podQuery.isPending ? (
                  <p className="text-xs text-black/50">Checking your pod…</p>
                ) : pod ? (
                  <div className="flex items-center gap-3">
                    {others.length > 0 && (
                      <div className="flex flex-none -space-x-2">
                        {others.slice(0, FACES_SHOWN).map((m) => (
                          <Avatar key={m.userId} name={m.name} src={m.image} size="sm" className="ring-2 ring-white" />
                        ))}
                        {others.length > FACES_SHOWN && (
                          <span className="grid h-8 w-8 place-content-center rounded-full bg-[#222325] text-[10px] font-bold text-white ring-2 ring-white">
                            +{others.length - FACES_SHOWN}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-primary">Post to {pod.name}</p>
                      <p className="truncate text-[11px] text-black/55">
                        {others.length === 0
                          ? "Just you so far — it'll be there when they join."
                          : `${others.length} ${others.length === 1 ? "person sees" : "people see"} it on What's moving.`}
                      </p>
                    </div>
                    <StickerButton
                      variant={outcomes.pod ? "outline" : "primary"}
                      size="sm"
                      className="flex-none"
                      disabled={!!outcomes.pod || sharePost.isPending}
                      onClick={postToPod}>
                      {outcomes.pod ? <Check className="h-3.5 w-3.5" /> : <UsersRound className="h-3.5 w-3.5" />}
                      {outcomes.pod ? "Posted" : sharePost.isPending ? "Posting…" : "Post"}
                    </StickerButton>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-black/60">No pod yet — a pod is where a win gets cheered.</p>
                    <Link
                      href="/dashboard/pod"
                      onClick={() => onOpenChange(false)}
                      className="inline-flex flex-none items-center gap-1 text-xs font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                      Find a pod
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Your network. Labels change to what we actually know happened. */}
              <div className={cn("mt-4 grid gap-2 w-full", targets.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
                {targets.map((t) => {
                  const Icon = t.icon;
                  const outcome = outcomes[t.id];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={t.onClick}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-3 cursor-pointer transition-colors",
                        outcome ? "border-[#222325] bg-[#f7fbe4] text-primary" : "border-black/10 text-black/60 hover:border-black/25",
                      )}>
                      {outcome ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      <span className="text-[10px] font-semibold leading-tight text-center">{outcome ? OUTCOME_LABEL[outcome] : t.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-4 text-sm font-semibold text-black/45 hover:text-black/65 cursor-pointer">
                {Object.keys(outcomes).length > 0 ? "Done" : "Not now"}
              </button>

              {/* Footer: what the link in the caption is worth — the invites page's own rate. */}
              {invites.data && (
                <p className="mt-5 pt-4 border-t border-black/8 w-full text-left text-xs text-black/45">
                  The link is your invite link: anyone who signs up from it counts as your invite, and you earn{" "}
                  {invites.data.creditsPerSubscriber} referral credits when one subscribes.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareWinModal;
