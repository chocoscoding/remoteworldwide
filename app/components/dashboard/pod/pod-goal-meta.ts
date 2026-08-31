import type { LucideIcon } from "lucide-react";
import { FileText, Mic, PartyPopper, Send, Trophy, Users } from "lucide-react";
import type { PodGoalKind } from "@/app/lib/dashboard/types";

/**
 * One lookup for everything a goal's kind implies: the icon that identifies
 * it at a glance, and the utility that carries you to the surface where the
 * work actually happens. Logging lives in the tracker and its sibling
 * screens — a pod goal points there rather than growing its own input.
 *
 * `href: null` (job-win) means the action opens the win-log modal instead of
 * navigating; `custom` carries no action at all.
 */
export const GOAL_KIND_META: Record<
  PodGoalKind,
  { icon: LucideIcon; kindLabel: string; actionLabel: string | null; href: string | null }
> = {
  "job-win": { icon: PartyPopper, kindLabel: "Job win", actionLabel: "Log your win", href: null },
  applications: { icon: Send, kindLabel: "Applications", actionLabel: "Open your tracker", href: "/dashboard/tracker" },
  referrals: { icon: Users, kindLabel: "Referrals", actionLabel: "Find a referral", href: "/dashboard/referrals" },
  prep: { icon: Mic, kindLabel: "Interview prep", actionLabel: "Run a prep session", href: "/dashboard/prep" },
  resume: { icon: FileText, kindLabel: "Resume", actionLabel: "Work on your resume", href: "/dashboard/resume" },
  custom: { icon: Trophy, kindLabel: "Custom", actionLabel: null, href: null },
};

/** The kinds a member may pick when suggesting a goal — job-win is the pod's protected default, not suggestable. */
export const SUGGESTABLE_KINDS: PodGoalKind[] = ["applications", "referrals", "prep", "resume", "custom"];
