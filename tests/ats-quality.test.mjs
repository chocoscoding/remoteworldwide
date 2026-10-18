// The ATS and resume-writing quality fixes on the website (RWW/ATS-QUALITY-PLAN.md, owner,
// 2026-10-18): new bullets counted apart from reworded ones, the AI numbers Quantify adds kept for
// the person to check, the design's readability flags, and the apply wizard keeping what the tools
// left out with advice.
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

const { changeCaption, resumeChanges } = await import("../app/lib/apply/changes.ts");
const { addedFigures, changedLines, clearAiFigures, pendingAiFigures, withAiFigures, withLonger } = await import("../app/lib/dashboard/resume/ai-figures.ts");
const { readabilityFlags } = await import("../app/lib/dashboard/resume/readability.ts");
const { DEFAULT_DESIGN, DEFAULT_SECTIONS } = await import("../app/lib/dashboard/resume/design-defaults.ts");
const { readApplyState } = await import("../app/lib/apply/state.ts");

const content = (overrides = {}) => ({
  name: "Tobi Ade",
  title: "Customer Success Manager",
  location: "Lagos, Nigeria",
  email: "",
  phone: "",
  portfolio: "",
  links: [],
  summary: "",
  experience: [{ id: "x1", role: "Customer Success Manager", company: "Kite", dates: "2022 – 2026", bullets: ["Ran quarterly business reviews", "Onboarded new accounts"] }],
  education: [{ id: "e1", school: "Unilag", degree: "BSc", dates: "2016 – 2020" }],
  projects: [],
  certifications: [],
  skills: ["HubSpot"],
  ...overrides,
});

describe("what a tool changed, counted by kind", () => {
  it("tells a new bullet from a reworded one (the Pencil run's '4 bullets reworded' were four new bullets)", () => {
    const before = content();
    const after = content({
      summary: "Customer Success Manager with 4+ years of experience.",
      experience: [
        {
          ...before.experience[0],
          bullets: ["Ran quarterly business reviews for 100+ accounts", "Onboarded new accounts", "Grew renewals by running quarterly reviews"],
        },
      ],
      skills: ["HubSpot", "Gainsight"],
    });
    const changes = resumeChanges(before, after);
    assert.deepEqual(changes.rewordedBullets, ["Ran quarterly business reviews for 100+ accounts"]);
    assert.deepEqual(changes.newBullets, ["Grew renewals by running quarterly reviews"]);
    assert.equal(changeCaption(changes, false), "New summary · 1 bullet improved · 1 new bullet · 1 skill added");
    assert.equal(changeCaption(changes, true), "Summary rewritten · 1 bullet improved · 1 new bullet · 1 skill added");
  });
});

describe("the AI's numbers", () => {
  const quantified = { before: "Onboarded new accounts", after: "Onboarded 40 new accounts a quarter, cutting setup time by 30%" };

  it("records only the numbers Quantify added", () => {
    assert.deepEqual(addedFigures("Cut churn from 5% to 2%", "Cut churn from 5% to 2% across 900+ accounts"), ["900+"]);
    const next = withAiFigures(content({ experience: [{ ...content().experience[0], bullets: ["Ran quarterly business reviews", quantified.after] }] }), [quantified]);
    assert.deepEqual(next.aiFigures.map((figure) => figure.figure), ["40", "30%"]);
    assert.equal(pendingAiFigures(next).length, 2);
  });

  it("drops a number the person edited, and the whole list once checked", () => {
    const next = withAiFigures(content({ experience: [{ ...content().experience[0], bullets: [quantified.after] }] }), [quantified]);
    const edited = { ...next, experience: [{ ...next.experience[0], bullets: ["Onboarded 35 new accounts a quarter, cutting setup time by 30%"] }] };
    assert.deepEqual(pendingAiFigures(edited).map((figure) => figure.figure), ["30%"]);
    assert.deepEqual(pendingAiFigures(clearAiFigures(next)), []);
  });

  it("brings the pill back with only the new number after 'I've checked them'", () => {
    const first = withAiFigures(content({ experience: [{ ...content().experience[0], bullets: [quantified.after] }] }), [quantified]);
    const checked = clearAiFigures(first);
    const again = { before: "Ran quarterly business reviews", after: "Ran quarterly business reviews for 12 enterprise clients" };
    const later = withAiFigures({ ...checked, experience: [{ ...checked.experience[0], bullets: [quantified.after, again.after] }] }, [again]);
    assert.equal(later.aiFiguresCleared, false);
    assert.deepEqual(pendingAiFigures(later).map((figure) => figure.figure), ["12"]);
  });
});

describe("numbers Ask adds when asked (owner, 2026-10-18: do what the person asks, mark it to check)", () => {
  it("records the numbers in every line an edit changed, the summary included", () => {
    const before = content({ summary: "Customer Success Manager." });
    const after = content({
      summary: "Customer Success Manager with 4+ years.",
      experience: [{ ...before.experience[0], bullets: ["Ran quarterly business reviews for 120 accounts", "Onboarded new accounts"] }],
    });
    const pairs = changedLines(before, after);
    assert.equal(pairs.length, 2);
    const next = withAiFigures(after, pairs);
    assert.deepEqual(pendingAiFigures(next).map((figure) => figure.figure), ["4+", "120"]);
  });

  it("puts the much longer lines in by address once the person keeps them", () => {
    const base = content({ summary: "Short." });
    const kept = withLonger(base, [
      { at: "summary", after: "A much longer summary, kept on purpose." },
      { at: "0.1", after: "Onboarded 40 new accounts in a quarter with a playbook the team still uses" },
      { at: "9.9", after: "No such line" },
    ]);
    assert.equal(kept.summary, "A much longer summary, kept on purpose.");
    assert.equal(kept.experience[0].bullets[1], "Onboarded 40 new accounts in a quarter with a playbook the team still uses");
    assert.equal(changedLines(base, kept).length, 2);
  });
});

describe("readability", () => {
  it("has nothing to say about the default one column design", () => {
    assert.deepEqual(readabilityFlags(DEFAULT_DESIGN, DEFAULT_SECTIONS, content()), []);
  });

  it("flags two columns, a photo, an unusual heading and education first, each with its fix", () => {
    const design = { ...DEFAULT_DESIGN, layout: { ...DEFAULT_DESIGN.layout, columns: "two" }, photo: { ...DEFAULT_DESIGN.photo, show: true } };
    const experience = DEFAULT_SECTIONS.findIndex((section) => section.kind === "experience");
    const education = DEFAULT_SECTIONS.findIndex((section) => section.kind === "education");
    const sections = DEFAULT_SECTIONS.map((section) => (section.kind === "experience" ? { ...section, label: "My Journey" } : section));
    const [moved] = sections.splice(education, 1);
    sections.splice(experience, 0, moved);
    const flags = readabilityFlags(design, sections, content());
    assert.deepEqual(
      flags.map((flag) => flag.id),
      ["columns", "photo", "heading-name", "education-first"],
    );
    assert.deepEqual(flags[0].fix, [{ type: "layout/setColumns", columns: "one" }]);
    assert.equal(flags[1].soft, true);
  });
});

describe("the apply wizard keeps what a tool left out", () => {
  it("reads back advice, placed lines and the states the score was explained from", () => {
    const report = { scanId: "s1", resumeVersion: 2, score: 61, metrics: [], gaps: [], verdicts: [], degraded: false, degradedReason: null, explanation: null, rewrites: [] };
    const state = readApplyState({
      resume: {},
      scan: { resumeId: "r1", version: 2, report, previousScore: 55, previousStates: { a: "missing", b: "partial", c: "bogus" } },
      proposal: {
        tool: "keywords",
        forResumeId: "r1",
        content: content(),
        terms: ["renewals"],
        unbacked: [],
        missed: [],
        notShown: [{ term: "Candidates must be located in Europe", advice: "It never goes on a resume." }, { term: 3 }],
        placed: { renewals: ["Grew renewals by running quarterly reviews"] },
      },
    });
    assert.deepEqual(state.scan.previousStates, { a: "missing", b: "partial" });
    assert.deepEqual(state.proposal.notShown, [{ term: "Candidates must be located in Europe", advice: "It never goes on a resume." }]);
    assert.deepEqual(state.proposal.placed, { renewals: ["Grew renewals by running quarterly reviews"] });
  });
});

const { fixHref, fixInstruction, fixesFor } = await import("../app/lib/ats/fix-handoff.ts");

describe("Fix these in my resume (owner, 2026-10-18)", () => {
  const verdict = (id, state, label, closest) => ({
    requirement: { id, text: label, label, type: "required", category: "skill", weight: 4, proof: [] },
    state,
    score: 0.4,
    resolvedBy: "rerank",
    evidence: closest ? [{ chunkId: "c1", text: closest, section: "experience", role: "CSM", score: 0.5 }] : [],
    confidence: "medium",
  });
  const report = {
    scanId: "s1",
    resumeVersion: 1,
    score: 64,
    metrics: [],
    gaps: [],
    verdicts: [
      verdict("r1", "missing", "Gainsight", null),
      verdict("r2", "partial", "Renewals", "Ran quarterly business reviews"),
      verdict("r3", "satisfied", "HubSpot", "Ran HubSpot"),
      { ...verdict("r4", "missing", "Candidates must be located in Europe", null), requirement: { ...verdict("r4", "missing", "x", null).requirement, category: "eligibility" } },
    ],
    degraded: false,
    degradedReason: null,
    explanation: null,
    rewrites: [{ chunkId: "c1", before: "Onboarded accounts", after: "Onboarded 40 accounts a quarter", why: "Shows the scale" }],
    stuffing: ["HubSpot appears 5 times"],
    advice: [{ id: "results", metric: "impact-language", title: "Show a result in 3 bullets", detail: "Say what changed.", lines: ["Worked on support"] }],
  };
  const job = { company: "Pencil", role: "Account Manager", description: "..." };

  it("hands over every correction: rewrites, the posting's gaps, advice and stuffing, never eligibility", () => {
    const fixes = fixesFor(report, job);
    assert.equal(fixes[0], 'Replace "Onboarded accounts" with "Onboarded 40 accounts a quarter" (Shows the scale).');
    assert.ok(fixes.some((fix) => fix.includes('"Gainsight", not shown')));
    assert.ok(fixes.some((fix) => fix.includes('"Renewals", partly shown. Reword "Ran quarterly business reviews"')));
    assert.ok(!fixes.some((fix) => /HubSpot", (not|partly)/.test(fix)));
    assert.ok(!fixes.some((fix) => /Europe/.test(fix)));
    assert.ok(fixes.some((fix) => fix.startsWith("Show a result in 3 bullets. Say what changed.")));
    assert.ok(fixes.some((fix) => fix.startsWith("It reads as stuffed: HubSpot appears 5 times.")));
    assert.ok(fixes.every((fix) => fix.length <= 400 && !fix.includes("—")));
  });

  it("leaves a general report's verdicts alone and keeps the instruction short", () => {
    assert.ok(!fixesFor(report, null).some((fix) => fix.includes("The posting asks")));
    assert.ok(fixInstruction(job).length <= 500);
    assert.equal(fixInstruction(null), "Fix what my ATS check found, in the lines I already have.");
  });

  it("opens a made-here resume itself and an upload's editable copy", () => {
    assert.equal(fixHref({ id: "64b000000000000000000001", source: "created" }), "/dashboard/resume?doc=64b000000000000000000001&fix=1");
    assert.equal(fixHref({ id: "up_12", source: "uploaded" }), "/dashboard/resume?from=up_12&fix=1");
  });
});

const { askDesignSettings, checkedAskAction, designActionFor, panelOf } = await import("../app/lib/dashboard/resume/ask-actions.ts");

describe("Ask's editor actions (owner, 2026-10-18: act within Customize and AI tools)", () => {
  it("turns a design setting into the panel's own action, snapped to the slider's steps", () => {
    assert.deepEqual(designActionFor("lineHeight", 1.43), { type: "spacing/set", key: "lineHeight", value: 1.4 });
    assert.deepEqual(designActionFor("basePt", 30), { type: "fontSize/setBase", pt: 14 });
    assert.deepEqual(designActionFor("headingSizePt", 3), { type: "fontSize/setOffset", key: "heading", pt: 3 });
    assert.deepEqual(designActionFor("accent", "#1F4E79"), { type: "colors/setAccent", hex: "#1f4e79" });
    assert.deepEqual(designActionFor("template", "meridian"), { type: "template/apply", id: "meridian" });
    assert.equal(designActionFor("accent", "red"), null);
    assert.equal(designActionFor("bodyFont", "comic-sans"), null);
    assert.equal(panelOf("marginXmm"), "spacing");
    assert.equal(panelOf("nameSizePt"), "font-size");
  });

  it("runs only actions it offers, on sections that exist", () => {
    const ids = new Set(["summary", "experience"]);
    assert.deepEqual(checkedAskAction({ do: "section", section: "experience" }, ids), { do: "section", section: "experience" });
    assert.equal(checkedAskAction({ do: "section", section: "photos" }, ids), null);
    assert.equal(checkedAskAction({ do: "tool", tool: "buy" }, ids), null);
    assert.equal(checkedAskAction({ do: "design", set: "lineHeight", value: "tall" }, ids), null);
    assert.equal(checkedAskAction({ do: "navigate", url: "https://example.com" }, ids), null);
  });

  it("reads the design's current values for the prompt", () => {
    const settings = askDesignSettings(DEFAULT_DESIGN);
    assert.equal(settings.lineHeight, DEFAULT_DESIGN.spacing.lineHeight);
    assert.equal(settings.bodyFont, DEFAULT_DESIGN.font.body);
    assert.equal("template" in settings, false);
  });
});
