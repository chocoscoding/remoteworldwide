// What Free does not get (owner, 2026-10-01): the career coach, talking it
// through by voice (the coach and Ask about a job; typed Ask about a job stays
// free), the daily plan, the job-search pod and being recommended to companies
// start at Basic, and Free keeps one cover letter. Streaks stay on Free.
//
// Checked here: each lock on the site names the same plan, in the same words,
// as the refusal behind it (app/lib/settings/planGates.ts against the AI
// service's planService and the backend's requirePlan, where those repos are
// checked out beside this one); every screen that offers one of these features
// reads its lock; a stale page that is refused anyway is handled (the plan
// failure kinds and the upgrade popup); and the talk state says the plan
// problem calmly with nothing to retry.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as plans.test.mjs. Only modules Node can load as written are
// imported (planGates.ts and talkState.ts carry types only); the API clients
// use TypeScript parameter properties, which strip-only mode cannot run, so
// their handling of a refusal is checked in their source.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    const isPath = target.startsWith(".") || target.startsWith("file:");
    if (isPath && !/\.[cm]?[jt]sx?$/.test(target)) {
      const base = new URL(target, context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(target, context);
  },
});

const { BASIC_GATES } = await import("../app/lib/settings/planGates.ts");
const { TALK_PROBLEM_KINDS, problemAction, problemCopy } = await import("../app/lib/voice/talkState.ts");
const { ELIGIBILITY_REQUIREMENTS } = await import("../app/lib/recommendations/types.ts");

const site = (path) => readFileSync(fileURLToPath(new URL(path, ROOT)), "utf8");
const sibling = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const AI = sibling("remoteworldwideai/src/services/");
const BACKEND = sibling("remoteworldwidebackend/src/");
const ai = (file) => readFileSync(`${AI}${file}`, "utf8");
const backend = (file) => readFileSync(`${BACKEND}${file}`, "utf8");

/** How both services finish a refusal: "<feature> is on Basic and up." */
const sentence = (feature) => `${feature} is on Basic and up.`;

describe("the Basic gates", () => {
  it("all start at Basic", () => {
    for (const [name, gate] of Object.entries(BASIC_GATES)) assert.equal(gate.plan, "basic", name);
  });

  it("are read by every screen that offers them", () => {
    for (const [file, gates] of [
      ["app/(pages)/(dashboard)/dashboard/coach/Client.tsx", ["coach", "voice"]],
      ["app/(pages)/(dashboard)/dashboard/jdqa/Client.tsx", ["voice"]],
      ["app/components/dashboard/plan/PlanPanel.tsx", ["dailyPlan"]],
      ["app/(pages)/(dashboard)/dashboard/Client.tsx", ["dailyPlan"]],
      ["app/components/dashboard/plan/AddToPlanButton.tsx", ["dailyPlan"]],
      ["app/components/dashboard/coach/ProposalCard.tsx", ["dailyPlan"]],
      ["app/components/dashboard/pod/PodLocked.tsx", ["pod"]],
      ["app/components/dashboard/modals/ShareWinModal.tsx", ["pod"]],
      ["app/components/dashboard/tracker/JobTimelineDialog.tsx", ["pod"]],
      ["app/(pages)/(dashboard)/dashboard/recommend/Client.tsx", ["recommendations"]],
      ["app/(pages)/(dashboard)/dashboard/recommend/[id]/Client.tsx", ["recommendations"]],
      ["app/(pages)/(dashboard)/dashboard/cover/Client.tsx", ["coverLetters"]],
      ["app/(pages)/(dashboard)/dashboard/apply/steps/CoverStep.tsx", ["coverLetters"]],
    ]) {
      const source = site(file);
      for (const gate of gates) assert.ok(source.includes(`BASIC_GATES.${gate}`), `${file} no longer reads BASIC_GATES.${gate}`);
    }
  });

  it("keep the mic: Talk below Basic opens the upgrade popup instead of starting a call", () => {
    for (const file of ["app/(pages)/(dashboard)/dashboard/coach/Client.tsx", "app/(pages)/(dashboard)/dashboard/jdqa/Client.tsx"]) {
      assert.match(site(file), /if \(voiceLock\.locked\) \{\s*voiceLock\.upgrade\(\);\s*return;\s*\}/, file);
    }
  });

  it("read nothing they would be refused: the plan, the pod and the list are only fetched at Basic", () => {
    assert.ok(site("app/(pages)/(dashboard)/dashboard/Client.tsx").includes("useTasks(planPeriod, undefined, { enabled: !planLock.locked })"));
    assert.ok(site("app/components/dashboard/plan/AddToPlanButton.tsx").includes("useTasks(period, undefined, { enabled: !lock.locked })"));
    assert.ok(site("app/components/dashboard/modals/ShareWinModal.tsx").includes("usePodOverview({ enabled: open && !podLock.locked })"));
    // Below Basic only for someone holding a redeemed priority intro (a streak gift), which the backend admits.
    const recommend = site("app/(pages)/(dashboard)/dashboard/recommend/Client.tsx");
    assert.ok(recommend.includes("const locked = lock.locked && !holdsPriorityIntro(gifts);") && recommend.includes("useRecommendations({ enabled: !locked })"));
    // The pod's first paint is the server's: a refusal there is the locked screen, not an error page.
    const page = site("app/(pages)/(dashboard)/dashboard/pod/page.tsx");
    assert.ok(page.includes('error.code === "plan_required"') && page.includes("<PodLocked />"));
  });

  it("send nothing on their own that would be refused: a win's pod post, a report's plan tasks", () => {
    // A win is still logged and celebrated on Free; only the pod post is left out.
    assert.ok(site("app/components/dashboard/win/WinProvider.tsx").includes("if (!podLock.locked) recordJobWin.mutate("));
    assert.ok(site("app/components/dashboard/win/WinLogDialog.tsx").includes("usePlanLock(BASIC_GATES.pod)"));
    // A report adds nothing to the plan by itself (owner, 2026-10-04: an explicit "Add all to my plan" only),
    // and on Free that button asks to upgrade instead of adding.
    assert.ok(!/autoPlan|AUTO_PLAN/.test(site("app/components/dashboard/prep/PrepReport.tsx")));
    assert.match(site("app/components/dashboard/prep/report/FixChecklist.tsx"), /if \(lock\.locked\) \{\s*lock\.upgrade\(\);\s*return;\s*\}/);
  });

  it("show Talk as locked rather than hiding it", () => {
    for (const file of ["app/(pages)/(dashboard)/dashboard/coach/Client.tsx", "app/(pages)/(dashboard)/dashboard/jdqa/Client.tsx"]) {
      const source = site(file);
      assert.match(source, /: voiceLock\.locked\s*\?\s*"On Basic and up"/, file);
      assert.match(source, /voiceLock\.locked \? \(\s*\/\/[^\n]*\n\s*<Lock /, file);
    }
  });
});

describe("a stale page refused anyway", () => {
  it("is a calm plan failure in the coach, not a red one, and opens the popup", () => {
    const coach = site("app/lib/coach/api.ts");
    assert.match(coach, /if \(error\.code === "plan_required"\) return \{ kind: "plan", message, retryable: false, retryAt: null \};/);
    assert.match(coach, /if \(code === "plan_required"\) signalPlanLimit\(/);
    assert.ok(site("app/(pages)/(dashboard)/dashboard/coach/Client.tsx").includes('failure.kind === "plan"'));
  });

  it("is a plan failure for a cover letter, with the way to upgrade beside it", () => {
    assert.match(site("app/lib/cover/api.ts"), /if \(error\.code === "plan_required"\) return \{ kind: "plan", message: error\.message, retryable: false \};/);
    assert.ok(site("app/(pages)/(dashboard)/dashboard/cover/Client.tsx").includes('failure.kind === "plan"'));
    assert.ok(site("app/(pages)/(dashboard)/dashboard/apply/steps/CoverStep.tsx").includes('cover.failure.kind === "plan"'));
  });

  it("is a plan problem for a voice call, which opens the popup and offers nothing to retry", () => {
    const voice = site("app/lib/voice/conversations.ts");
    assert.match(voice, /if \(error\.code === "plan_required"\) signalPlanLimit\(/);
    assert.match(voice, /if \(error instanceof BackendError && error\.code === "plan_required"\) return \{ kind: "plan" \};/);
    assert.ok(TALK_PROBLEM_KINDS.includes("plan"));
    assert.equal(problemCopy({ kind: "plan" }), "Talking it through is on Basic and up. Type instead");
    assert.equal(problemAction({ kind: "plan" }), null);
  });
});

describe("recommendations' checklist", () => {
  it("carries the plan as a requirement, linked to Billing", () => {
    assert.equal(ELIGIBILITY_REQUIREMENTS.at(-1), "plan");
    assert.match(site("app/components/dashboard/recommend/EligibilityCard.tsx"), /plan: \{ href: "\/dashboard\/settings\/billing", place: "Billing" \}/);
  });
});

describe("the AI service's refusals (remoteworldwideai)", { skip: !existsSync(AI) }, () => {
  it("are the coach's, voice's and the coach plan's, in the site's words", () => {
    const coach = ai("coachService.ts");
    const feature = /const COACH_FEATURE = "([^"]+)";/.exec(coach)?.[1];
    assert.ok(feature, "coachService.ts no longer names COACH_FEATURE");
    assert.equal(sentence(feature), BASIC_GATES.coach.message);
    assert.equal((coach.match(/requireTier\(uid, "basic", COACH_FEATURE\)/g) ?? []).length, 2, "the coach is gated at a new session and at a turn");
    assert.match(coach, /requireTier\(uid, "basic", "The daily plan"\)/);
    assert.equal(sentence("The daily plan"), BASIC_GATES.dailyPlan.message);
    assert.match(ai("voiceConversationService.ts"), /requireTier\(userId, "basic", "Talking it through by voice"\)/);
    assert.equal(sentence("Talking it through by voice"), BASIC_GATES.voice.message);
  });

  it("keep one cover letter on Free, word for word", () => {
    const plan = ai("planService.ts");
    assert.ok(plan.includes(`refusal("${BASIC_GATES.coverLetters.message}", "basic", tier)`));
    assert.match(ai("coverLetterService.ts"), /PlanService\.letterLimit\(userId, held\)/);
    assert.match(ai("coverDocumentService.ts"), /PlanService\.letterLimit\(userId, count\)/);
  });

  it("leave typed Ask about a job free", () => {
    assert.doesNotMatch(ai("jobAskService.ts"), /requireTier/);
  });
});

describe("the backend's refusals (remoteworldwidebackend)", { skip: !existsSync(BACKEND) }, () => {
  it("are the plan's, the pod's and recommendations', in the site's words", () => {
    assert.ok(backend("services/planGate.ts").includes("`${feature} is on ${PLAN_NAMES[min]} and up.`"));
    for (const [file, feature, gate] of [
      ["routes/task.routes.ts", "The daily plan", "dailyPlan"],
      ["routes/pod.routes.ts", "The job-search pod", "pod"],
      ["routes/recommendation.routes.ts", "Being recommended to companies", "recommendations"],
    ]) {
      // A third argument is an alternative entitlement (recommendations: a waiting priority intro, a streak gift).
      assert.ok(backend(file).includes(`requirePlan("basic", "${feature}")`) || backend(file).includes(`requirePlan("basic", "${feature}", `), file);
      assert.equal(sentence(feature), BASIC_GATES[gate].message, file);
    }
  });

  it("leave streaks, leaving a pod and the internal routes alone", () => {
    assert.doesNotMatch(backend("routes/streak.routes.ts"), /requirePlan/);
    assert.match(backend("routes/pod.routes.ts"), /router\.post\("\/leave", isAuthenticated, PodController\.leave\)/);
    assert.doesNotMatch(backend("routes/internal.routes.ts"), /requirePlan/);
    assert.doesNotMatch(backend("routes/internalTask.routes.ts"), /requirePlan/);
  });

  it("list the same eligibility requirements as the site", () => {
    const list = /export const ELIGIBILITY_REQUIREMENTS = \[([^\]]*)\] as const;/.exec(backend("types/recommendations.ts"))?.[1] ?? "";
    assert.deepEqual([...list.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]), [...ELIGIBILITY_REQUIREMENTS]);
  });
});
