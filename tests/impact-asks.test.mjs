// The Impact fix's estimates as asks (app/lib/apply/impact-asks.ts, owner 2026-10-22, fix plan 1e):
// "Fix them" applies only the proposals the resume anchors, each estimate waits as an ask row, and
// the person's number goes into the AI's line in place of the AI's.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as apply.test.mjs: Node resolves neither the `@/` alias nor an extensionless `./x`.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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

const { answerHint, answerPlaceholder, openEstimates, splitEstimates, withYourNumber } = await import("../app/lib/apply/impact-asks.ts");
const { clearAiFigures, pendingAiFigures, withAiFigures, withOwnFigures } = await import("../app/lib/dashboard/resume/ai-figures.ts");

const COACHED = "Coached leaders and guided them through complex people cases";
const FUNNELS = "Built out the web funnels end-to-end, acquisition to paywall to activation";
const proposal = (extra) => ({ entryIndex: 0, bulletIndex: 0, role: "HR Director", before: COACHED, after: "Coached 8 leaders and guided them through complex people cases", ...extra });

describe("splitEstimates", () => {
  it("applies what the resume anchors and asks about the rest", () => {
    const ready = proposal({ bulletIndex: 1, before: "Led onboarding programs.", after: "Led onboarding programs that lifted adoption by 15%." });
    const ask = proposal({ estimate: true, question: "How many leaders did you coach?" });
    const { ready: applied, asks } = splitEstimates([ready, ask]);
    assert.deepEqual(applied, [ready]);
    assert.deepEqual(asks, [ask]);
  });

  it("holds an estimate even when legacy question metadata is missing", () => {
    assert.equal(splitEstimates([proposal({ estimate: true })]).ready.length, 0);
    assert.equal(splitEstimates([proposal({ estimate: true })]).asks.length, 1);
    assert.equal(splitEstimates([proposal({})]).asks.length, 0);
  });
});

describe("openEstimates", () => {
  const content = { experience: [{ id: "x0", role: "HR Director", company: "", dates: "", bullets: [COACHED] }], customSections: [{ id: "c1", items: ["", "Organised monthly meetups for the local developer community"] }] };
  it("keeps an ask while its line reads as it did, and drops it once the line changed", () => {
    const ask = proposal({ estimate: true, question: "How many leaders did you coach?" });
    assert.deepEqual(openEstimates(content, [ask]), [ask]);
    const edited = { ...content, experience: [{ ...content.experience[0], bullets: ["Coached 5 leaders through complex people cases"] }] };
    assert.deepEqual(openEstimates(edited, [ask]), []);
    assert.deepEqual(openEstimates(null, [ask]), []);
  });

  it("reads a custom section's point by its stored index", () => {
    const ask = { entryIndex: -1, bulletIndex: 1, role: "Volunteering", customId: "c1", before: "Organised monthly meetups for the local developer community", after: "", estimate: true, question: "?" };
    assert.equal(openEstimates(content, [ask]).length, 1);
  });
});

describe("withYourNumber", () => {
  it("accepts a supplied range but never assumes a new reporting period", () => {
    assert.equal(withYourNumber(COACHED, "Coached 8 leaders and guided them through complex people cases", "10-12"), "Coached 10–12 leaders and guided them through complex people cases");
    assert.equal(withYourNumber("Automated manual reporting", "Automated manual reporting, saving 8 hours per week", "10"), null);
  });
  it("puts the person's number where the AI's stood", () => {
    assert.equal(withYourNumber(COACHED, "Coached 8 leaders and guided them through complex people cases", "12"), "Coached 12 leaders and guided them through complex people cases");
    assert.equal(withYourNumber(FUNNELS, "Built out 4 web funnels end-to-end, acquisition to paywall to activation", " 6 "), "Built out 6 web funnels end-to-end, acquisition to paywall to activation");
  });

  it("requires explicit percentages and currencies rather than inheriting a guessed unit", () => {
    const before = "Led onboarding programs that improved early product adoption.";
    assert.equal(withYourNumber(before, "Led onboarding programs that lifted early product adoption by 15%.", "22"), null);
    assert.equal(withYourNumber(before, "Led onboarding programs that lifted early product adoption by 15%.", "22%"), "Led onboarding programs that lifted early product adoption by 22%.");
    assert.equal(withYourNumber("Managed the paid media budget", "Managed a $2M paid media budget", "3"), null);
    assert.equal(withYourNumber("Managed the paid media budget", "Managed a $2M paid media budget", "$1,500,000"), "Managed a $1,500,000 paid media budget");
  });

  it("keeps a + only when the person types one: their number is exact", () => {
    assert.equal(withYourNumber("Onboarded new clients", "Onboarded 100+ new clients", "140"), "Onboarded 140 new clients");
    assert.equal(withYourNumber("Onboarded new clients", "Onboarded 100+ new clients", "150+"), "Onboarded 150+ new clients");
  });

  it("never touches a number the person wrote, even one the AI's number sits inside", () => {
    const before = "Rolled out 40 dashboards to finance";
    assert.equal(withYourNumber(before, "Rolled out 40 dashboards to 4 finance teams", "6"), "Rolled out 40 dashboards to 6 finance teams");
  });

  it("refuses what is not a number, and a line with no AI number", () => {
    assert.equal(withYourNumber(COACHED, "Coached 8 leaders and guided them through complex people cases", "a few"), null);
    assert.equal(withYourNumber(COACHED, "Coached 8 leaders and guided them through complex people cases", ""), null);
    assert.equal(withYourNumber(COACHED, COACHED, "12"), null);
  });
});

describe("a from-to estimate takes both numbers (review, 2026-10-22)", () => {
  const before = "Accelerated time-to-value for new accounts by rebuilding the onboarding plan";
  const after = "Cut time-to-value for new accounts from 6 weeks to 2 by rebuilding the onboarding plan";

  it("puts both of the person's numbers where the AI's stood", () => {
    const want = "Cut time-to-value for new accounts from 8 weeks to 3 by rebuilding the onboarding plan";
    assert.equal(withYourNumber(before, after, "8 to 3"), want);
    assert.equal(withYourNumber(before, after, "8-3"), want);
    assert.equal(withYourNumber(before, after, "8, 3"), want);
  });

  it("never lets the person's first number stand in for the AI's second", () => {
    assert.equal(withYourNumber(before, after, "2 to 1"), "Cut time-to-value for new accounts from 2 weeks to 1 by rebuilding the onboarding plan");
  });

  it("asks again for one number alone, so no AI number is left unmarked in the line", () => {
    assert.equal(withYourNumber(before, after, "2"), null);
    assert.equal(answerHint({ before, after }), "Type both numbers, like 6 to 2.");
    assert.equal(answerPlaceholder({ before, after }), "e.g. 6 to 2");
    const single = { before: COACHED, after: "Coached 8 leaders and guided them through complex people cases" };
    assert.match(answerHint(single), /Include the unit/);
    assert.equal(answerPlaceholder(single), "e.g. 12");
  });
});

describe("the person's own number is kept as theirs (review, 2026-10-22)", () => {
  const line = "Coached 12 leaders and guided them through complex people cases";
  const content = { summary: "", experience: [{ id: "x0", role: "HR Director", company: "", dates: "", bullets: [line, "Grew renewals 20% across 80 accounts."] }], customSections: [] };

  it("records it as own, never in the AI numbers pill", () => {
    const next = withOwnFigures(content, COACHED, line);
    assert.deepEqual(next.aiFigures.map(({ figure, own }) => [figure, own]), [["12", true]]);
    assert.deepEqual(pendingAiFigures(next), []);
  });

  it("keeps it through a later AI number and through clearing the AI's", () => {
    const mine = withOwnFigures(content, COACHED, line);
    const both = withAiFigures(mine, [{ before: "Grew renewals across 80 accounts.", after: "Grew renewals 20% across 80 accounts." }]);
    assert.deepEqual(both.aiFigures.map(({ figure, own }) => [figure, Boolean(own)]), [["12", true], ["20%", false]]);
    assert.deepEqual(pendingAiFigures(both).map(({ figure }) => figure), ["20%"]);
    assert.deepEqual(clearAiFigures(both).aiFigures.map(({ figure }) => figure), ["12"]);
  });
});
