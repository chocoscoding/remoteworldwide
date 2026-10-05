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
}

/**
 * Not on Free (owner, 2026-10-01): the career coach, talking it through by voice (the coach and Ask
 * about a job; typed Ask about a job stays free), the daily plan, the job-search pod and being
 * recommended to companies start at Basic, and Free keeps one cover letter. Streaks stay on Free.
 * Each message is the service's own refusal, word for word (tests/basic-gates.test.mjs).
 */
export const BASIC_GATES = {
  coach: { plan: "basic", message: "The AI career coach is on Basic and up." },
  voice: { plan: "basic", message: "Talking it through by voice is on Basic and up." },
  dailyPlan: { plan: "basic", message: "The daily plan is on Basic and up." },
  pod: { plan: "basic", message: "The job-search pod is on Basic and up." },
  recommendations: { plan: "basic", message: "Being recommended to companies is on Basic and up." },
  coverLetters: {
    plan: "basic",
    message: "Free keeps one cover letter. Edit or revise it, delete it to start another, or upgrade to Basic to write more.",
  },
} as const satisfies Record<string, PlanGateSpec>;
