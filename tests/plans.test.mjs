// The four plans, Free / Basic / Pro / Ultra (owner, 2026-10-01): the fallback
// catalogue /pricing shows when the backend can't be reached, the comparison
// table's gates, the yearly badge, the upgrade popup's next tier and the ads
// gate (app/lib/pricing/catalogue.ts, app/lib/settings/types.ts).
//
// Where the backend and the AI service are checked out beside this repo, the
// fallback is compared with the backend's seeds, the tiers with both services'
// lists, and each plan lock on the site with the AI service's own gate, so the
// lock and the refusal behind it name the same plan.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as onboarding.test.mjs: Node resolves neither the `@/` alias nor
// an extensionless `./x`, so the hook maps them the way tsconfig does.

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

const { ESTIMATOR_ITEMS, FALLBACK_CATALOGUE, FEATURE_GROUPS, RECOMMENDED_PLAN, rowIncludes, yearlySavingLabel } = await import(
  "../app/lib/pricing/catalogue.ts"
);
const { AD_FREE_FROM, PLAN_TIERS, PLAN_TIER_NAMES, tierAllows, upgradeTierFor } = await import("../app/lib/settings/types.ts");

const sibling = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const site = (path) => readFileSync(fileURLToPath(new URL(path, ROOT)), "utf8");
const BACKEND_BILLING = sibling("remoteworldwidebackend/src/config/billing.ts");
const AI_PLAN = sibling("remoteworldwideai/src/services/planService.ts");
const AI_SERVICES = sibling("remoteworldwideai/src/services/");

const listOf = (source, name) => {
  const list = new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const;`).exec(source)?.[1];
  assert.ok(list, `${name} is no longer a literal array`);
  return [...list.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
};

const plan = (key) => FALLBACK_CATALOGUE.plans.find((p) => p.key === key);
const row = (label) => FEATURE_GROUPS.flatMap((group) => group.rows).find((r) => r.label === label);
const plansWith = (label) => PLAN_TIERS.filter((tier) => rowIncludes(row(label), tier));

describe("the four plans", () => {
  it("are the tiers, cheapest first, at the owner's prices and credits", () => {
    assert.deepEqual(
      FALLBACK_CATALOGUE.plans.map((p) => [p.key, p.name, p.priceCents, p.yearlyPriceCents ?? null, p.monthlyCredits]),
      [
        ["free", "Free", 0, null, 50],
        ["basic", "Basic", 1700, 18000, 100],
        ["pro", "Pro", 3100, 33600, 200],
        ["ultra", "Ultra", 5500, 60000, 400],
      ],
    );
    assert.deepEqual(FALLBACK_CATALOGUE.plans.map((p) => p.key), [...PLAN_TIERS]);
    assert.deepEqual(FALLBACK_CATALOGUE.plans.map((p) => p.name), PLAN_TIERS.map((tier) => PLAN_TIER_NAMES[tier]));
  });

  it("puts Pro forward, and gives Ultra the most credits", () => {
    assert.equal(RECOMMENDED_PLAN, "pro");
    const most = Math.max(...FALLBACK_CATALOGUE.plans.map((p) => p.monthlyCredits));
    assert.deepEqual(FALLBACK_CATALOGUE.plans.filter((p) => p.monthlyCredits === most).map((p) => p.key), ["ultra"]);
  });

  it("works the yearly badge out from the plans: about 10% across Basic, Pro and Ultra", () => {
    assert.equal(yearlySavingLabel(FALLBACK_CATALOGUE.plans), "Save ~10%");
    // Every plan on the 10% rule: one figure, said exactly.
    const flat = FALLBACK_CATALOGUE.plans.map((p) => ({ ...p, yearlyPriceCents: undefined }));
    assert.equal(yearlySavingLabel(flat), "Save 10%");
    // A yearly price changed in Mongo moves the badge with it.
    assert.equal(yearlySavingLabel([{ ...plan("pro"), yearlyPriceCents: 3100 * 12 * 0.8 }]), "Save 20%");
    assert.equal(yearlySavingLabel([plan("free")]), null);
  });
});

describe("the comparison table's gates", () => {
  it("Basic: no ads and the resume AI", () => {
    for (const label of ["No ads", "Build a resume with AI", "AI help in the resume builder"]) {
      assert.deepEqual(plansWith(label), ["basic", "pro", "ultra"], label);
    }
    assert.deepEqual(row("Resume builder").values, { free: "1 resume", basic: "Unlimited", pro: "Unlimited", ultra: "Unlimited" });
  });

  it("Pro: interview prep, voice interviews included", () => {
    const prep = FEATURE_GROUPS.find((group) => group.title === "Interview prep").rows;
    assert.ok(prep.some((r) => r.label === "Voice mock interviews"));
    for (const r of prep) assert.deepEqual(plansWith(r.label), ["pro", "ultra"], r.label);
    assert.deepEqual(ESTIMATOR_ITEMS.find((item) => item.key === "interviews").plans, ["pro", "ultra"]);
  });

  it("Ultra: priority support and early access", () => {
    assert.deepEqual(plansWith("Priority support"), ["ultra"]);
    assert.deepEqual(plansWith("Early access to new tools"), ["ultra"]);
  });

  it("names only plans that exist", () => {
    for (const r of FEATURE_GROUPS.flatMap((group) => group.rows)) {
      if (r.plans !== "all") for (const key of r.plans) assert.ok(PLAN_TIERS.includes(key), `${r.label}: ${key}`);
      for (const key of Object.keys(r.values ?? {})) assert.ok(PLAN_TIERS.includes(key), `${r.label}: ${key}`);
    }
  });
});

describe("the tiers on the site", () => {
  it("rank Free, Basic, Pro, Ultra, and a tier this build doesn't know is below them all", () => {
    for (const [held, tier] of PLAN_TIERS.entries()) {
      for (const [needed, min] of PLAN_TIERS.entries()) assert.equal(tierAllows(tier, min), held >= needed, `${tier} vs ${min}`);
    }
    assert.equal(tierAllows("enterprise", "free"), false);
    assert.equal(tierAllows(undefined, "free"), false);
  });

  it("show ads to Free only: Basic and up are ad-free", () => {
    assert.deepEqual(PLAN_TIERS.filter((tier) => !tierAllows(tier, AD_FREE_FROM)), ["free"]);
    assert.ok(site("app/lib/ads.ts").includes("!tierAllows(tier, AD_FREE_FROM)"));
  });

  it("offer the next tier up when credits run out, and Ultra packs only", () => {
    assert.equal(upgradeTierFor("free"), "basic");
    assert.equal(upgradeTierFor("basic"), "pro");
    assert.equal(upgradeTierFor("pro"), "ultra");
    assert.equal(upgradeTierFor("ultra"), null);
  });

  it("offer the plan a refusal names, never one at or below the account's own", () => {
    assert.equal(upgradeTierFor("free", "pro"), "pro");
    assert.equal(upgradeTierFor("basic", "pro"), "pro");
    assert.equal(upgradeTierFor("free", "basic"), "basic");
    assert.equal(upgradeTierFor("pro", "basic"), null);
    assert.equal(upgradeTierFor("pro", "pro"), null);
    // A plan this build doesn't know: the next tier up, as for credits.
    assert.equal(upgradeTierFor("basic", "enterprise"), "pro");
  });

  it("are what the popup and the plan chips use", () => {
    const modal = site("app/components/dashboard/billing/UpgradeModal.tsx");
    assert.ok(modal.includes("upgradeTierFor(tier, detail.kind === \"plan\" ? detail.requiredPlan : null)"));
    assert.ok(modal.includes("tierAllows(tier, min)"));
    assert.ok(modal.includes("PLAN_TIER_NAMES[plan]"));
  });
});

describe("the backend's seeds (remoteworldwidebackend config/billing.ts)", { skip: !existsSync(BACKEND_BILLING) }, () => {
  const billing = existsSync(BACKEND_BILLING) ? readFileSync(BACKEND_BILLING, "utf8") : "";

  it("are the tiers", () => {
    assert.deepEqual(listOf(billing, "PLAN_KEYS"), [...PLAN_TIERS]);
  });

  it("are what the fallback copies", () => {
    const seeds = [
      ...billing.matchAll(
        /key: "(\w+)",\s*name: "([^"]+)",\s*priceCents: (\d+),\s*yearlyPriceCents: (\d+|null),\s*monthlyCredits: (\d+),\s*prioritySupport: (true|false),\s*sortOrder: \d+,\s*features: \[([^\]]*)\]/g,
      ),
    ].map(([, key, name, price, yearly, credits, priority, features]) => ({
      key,
      name,
      priceCents: Number(price),
      yearlyPriceCents: yearly === "null" ? null : Number(yearly),
      monthlyCredits: Number(credits),
      prioritySupport: priority === "true",
      features: [...features.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]),
    }));
    assert.deepEqual(
      seeds,
      FALLBACK_CATALOGUE.plans.map((p) => ({
        key: p.key,
        name: p.name,
        priceCents: p.priceCents,
        yearlyPriceCents: p.yearlyPriceCents ?? null,
        monthlyCredits: p.monthlyCredits,
        prioritySupport: p.prioritySupport,
        features: p.features,
      })),
    );
  });
});

describe("the AI service's gates (remoteworldwideai services/planService.ts)", { skip: !existsSync(AI_PLAN) }, () => {
  const ai = (file) => readFileSync(`${AI_SERVICES}${file}`, "utf8");

  it("know the same tiers", () => {
    assert.deepEqual(listOf(readFileSync(AI_PLAN, "utf8"), "TIERS"), [...PLAN_TIERS]);
  });

  // Each lock on the site, and the refusal it saves a request for.
  for (const [lock, allows, service, gate] of [
    ["app/(pages)/(dashboard)/dashboard/resume/Client.tsx", 'allows("basic")', "resumeBuildService.ts", /requireTier\(\w+, "basic", "Building a resume with AI"\)/],
    ["app/components/dashboard/resume/ResumeScreenBody.tsx", 'allows("basic")', "suggestionService.ts", /requireTier\([\w.]+, "basic", "AI help with your resume"\)/],
    ["app/components/dashboard/resume/ResumeScreenBody.tsx", 'allows("basic")', "planService.ts", /upgrade to Basic to build more\.", "basic", tier\)/],
    ["app/components/dashboard/prep/PrepSetup.tsx", 'allows("pro")', "prepSessionService.ts", /requireTier\(\w+, "pro", "Interview prep"\)/],
    ["app/components/dashboard/prep/PrepSetup.tsx", 'allows("pro")', "likelyQuestionService.ts", /requireTier\(\w+, "pro", "Likely interview questions"\)/],
  ]) {
    it(`${lock.split("/").pop()} locks at the tier ${service} refuses below`, () => {
      assert.ok(site(lock).includes(allows), `${lock} no longer says ${allows}`);
      assert.match(ai(service), gate);
    });
  }
});
