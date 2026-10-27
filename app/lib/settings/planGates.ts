import type { PlanTier } from "./types";

/**
 * A feature a plan tier gates: the plan it starts at, and the sentence the service refuses it with
 * below that plan. The site locks the control at the same tier, so pressing it opens the upgrade
 * popup rather than sending a request the service would refuse; the services enforce it either way
 * (remoteworldwideai services/planService.ts, remoteworldwidebackend middleware/planGate.ts), and
 * a refusal from a stale page opens the same popup through `unwrapEnvelope`.
 */
export interface PlanGateSpec {
  plan: PlanTier;
  message: string;
  /**
   * Uses a month below `plan` before the service refuses (owner, 2026-10-15: Free gets every feature,
   * a little of each, except the pod). Above 0 the control is never locked up front: the service
   * counts the free uses, and its refusal once they are spent opens the upgrade popup by itself.
   * 0 keeps the up-front lock (the pod, and Free's one cover letter, which is a count, not a month).
   */
  freeMonthly: number;
}

/**
 * On Basic (owner, 2026-10-01): the career coach, talking it through by voice (the coach and Ask
 * about a job; typed Ask about a job stays free), a coach plan on the daily plan and the job-search
 * pod; Free keeps one cover letter. Streaks stay on Free. Since 2026-10-15 every one but the pod has
 * a monthly free allowance below Basic (`freeMonthly`, the AI service's FREE_MONTHLY), and the daily
 * plan itself is open to everyone. Being recommended to companies moved to Ultra (ULTRA_GATES). Each message is the service's refusal past the allowance, minus its "You've
 * used this month's free …" opening (tests/basic-gates.test.mjs).
 */
export const BASIC_GATES = {
  coach: { plan: "basic", message: "The AI career coach is on Basic and up.", freeMonthly: 5 },
  voice: { plan: "basic", message: "Talking it through by voice is on Basic and up.", freeMonthly: 1 },
  dailyPlan: { plan: "basic", message: "The daily plan is on Basic and up.", freeMonthly: 1 },
  pod: { plan: "basic", message: "The job-search pod is on Basic and up.", freeMonthly: 0 },
  coverLetters: {
    plan: "basic",
    message: "Free keeps one cover letter. Edit or revise it, delete it to start another, or upgrade to Basic to write more.",
    freeMonthly: 0,
  },
} as const satisfies Record<string, PlanGateSpec>;

/**
 * On Ultra alone (owner, 2026-10-26): being recommended directly to partner companies, with no free
 * one below it. The backend's eligibility holds the plan requirement (services/recommendationEligibility.ts);
 * a redeemed priority intro, a streak gift, still stands in for the plan there and here.
 */
export const ULTRA_GATES = {
  recommendations: { plan: "ultra", message: "Being recommended to partner companies is on Ultra.", freeMonthly: 0 },
} as const satisfies Record<string, PlanGateSpec>;

/** The AI tools and interview prep, with their monthly free uses below the plan they are on. */
export const FREE_ALLOWANCE_GATES = {
  resumeBuild: { plan: "basic", message: "Building a resume with AI is on Basic and up.", freeMonthly: 1 },
  resumeAi: { plan: "basic", message: "AI help with your resume is on Basic and up.", freeMonthly: 3 },
  prep: { plan: "pro", message: "Interview prep is on Pro and up.", freeMonthly: 1 },
  likelyQuestions: { plan: "pro", message: "Likely interview questions is on Pro and up.", freeMonthly: 1 },
} as const satisfies Record<string, PlanGateSpec>;
