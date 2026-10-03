// The apply wizard's pure parts: the state it keeps in its session and how a
// stored one is read back (app/lib/apply/state.ts), the steps behind a
// "Missing from your resume" chip (gapSteps.ts), what tailoring changed, for
// the preview's highlights (changes.ts), and the score card's colour and
// wording (score.ts).
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as print.test.mjs: Node resolves neither the `@/` alias nor an
// extensionless `./x`, so the hook maps them the way tsconfig does. The modules
// under test import types only, which is part of what this checks.

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

const { EMPTY_APPLY_STATE, readApplyState, readStep, readVisited, sendingResumeId } = await import("../app/lib/apply/state.ts");
const { INTERVIEW_ADVICE, excerpt, stepsForGap } = await import("../app/lib/apply/gapSteps.ts");
const { changeCount, highlightTexts, resumeChanges } = await import("../app/lib/apply/changes.ts");
const { noteParts, quantityParts, scoreColor, withoutEmDashes } = await import("../app/lib/apply/score.ts");

const content = (overrides = {}) => ({
  name: "Ada Obi",
  title: "Product Designer",
  location: "Lagos",
  email: "",
  phone: "",
  portfolio: "",
  links: [],
  summary: "Designer with six years in fintech. Ships design systems.",
  experience: [{ id: "x1", role: "Designer", company: "Kite", dates: "2020 – 2024", bullets: ["Led the checkout redesign", "Ran research"] }],
  education: [],
  projects: [],
  certifications: [],
  skills: ["Figma", "Research"],
  ...overrides,
});

const report = { scanId: "s1", resumeVersion: 2, score: 61, metrics: [], gaps: [], verdicts: [], degraded: false, degradedReason: null, explanation: null, rewrites: [] };

describe("reading a session's state", () => {
  it("answers the defaults for nothing, or for something that isn't an object", () => {
    assert.deepEqual(readApplyState(undefined), EMPTY_APPLY_STATE);
    assert.deepEqual(readApplyState("junk"), EMPTY_APPLY_STATE);
    assert.deepEqual(readApplyState([]), EMPTY_APPLY_STATE);
  });

  it("reads back what the wizard wrote", () => {
    const written = {
      resume: { baseId: "b1", baseName: "cv.pdf", draftId: "d1", draftName: "cv — Acme", draftFromId: "b1", sendDraft: true, creatorDocId: null },
      scan: { resumeId: "d1", version: 2, report, previousScore: 54 },
      proposal: null,
      cover: {
        letter: "Hi",
        html: "<p>Hi</p>",
        design: { theme: "warm", font: "serif", spacing: "airy", letterhead: "full" },
        skipped: false,
        tone: "formal",
        shown: "formal",
        drafts: { formal: "Hi", own: "Mine" },
        writtenFrom: "d1",
      },
      questions: [{ id: "q-3", question: "Why us?", answer: "Because", drafted: { confidence: 0.8, cat: "motivation" }, edited: false }],
      tracked: false,
    };
    assert.deepEqual(readApplyState(written), written);
  });

  it("drops what is the wrong shape and keeps the rest", () => {
    const state = readApplyState({
      resume: { baseId: 7, baseName: "cv.pdf", sendDraft: true },
      scan: { resumeId: "b1", version: "2", report },
      cover: { tone: "shouty", shown: "nope", drafts: { warm: "ok", bogus: "x", short: 4 } },
      questions: "not a list",
    });
    assert.equal(state.resume.baseId, null);
    assert.equal(state.resume.baseName, "cv.pdf");
    // No draft to send: sending it is off.
    assert.equal(state.resume.sendDraft, false);
    assert.equal(state.scan, null);
    assert.equal(state.cover.tone, "warm");
    assert.equal(state.cover.shown, null);
    assert.deepEqual(state.cover.drafts, { warm: "ok" });
    assert.deepEqual(state.questions, EMPTY_APPLY_STATE.questions);
  });

  it("reads a score from before the previous one was kept, and a letter design control by control", () => {
    const state = readApplyState({
      scan: { resumeId: "b1", version: 1, report },
      cover: { letter: "Hi", design: { theme: "neon", font: "serif", spacing: 3 } },
    });
    assert.equal(state.scan?.previousScore, null);
    assert.equal(state.cover.html, "");
    // Each unknown control falls back on its own; the known one is kept.
    assert.deepEqual(state.cover.design, { ...EMPTY_APPLY_STATE.cover.design, font: "serif" });
  });

  it("keeps a proposal only with a resume it can render", () => {
    const good = readApplyState({ proposal: { tool: "keywords", forResumeId: "b1", content: content(), terms: ["Go"], unbacked: ["Docker"] } });
    assert.equal(good.proposal?.tool, "keywords");
    assert.deepEqual(good.proposal?.unbacked, ["Docker"]);
    assert.equal(readApplyState({ proposal: { tool: "keywords", forResumeId: "b1", content: { summary: "x" } } }).proposal, null);
    assert.equal(readApplyState({ proposal: { tool: "nuke", forResumeId: "b1", content: content() } }).proposal, null);
  });

  it("sends the draft only when it is chosen and exists", () => {
    const base = { ...EMPTY_APPLY_STATE.resume, baseId: "b1" };
    assert.equal(sendingResumeId(base), "b1");
    assert.equal(sendingResumeId({ ...base, draftId: "d1" }), "b1");
    assert.equal(sendingResumeId({ ...base, draftId: "d1", sendDraft: true }), "d1");
  });

  it("reads the step and the visited steps, always including the one on screen", () => {
    assert.equal(readStep(3), 3);
    assert.equal(readStep(9), 1);
    assert.equal(readStep("2"), 1);
    assert.deepEqual(readVisited([1, 5, 5, "x", 7], 3), [1, 3, 5]);
    assert.deepEqual(readVisited(null, 2), [2]);
  });
});

const verdict = (category, state, evidence = []) => ({
  requirement: { id: "r1", text: "Hands-on experience with Docker in production", type: "required", category, weight: 1 },
  state,
  score: 0.3,
  resolvedBy: "cosine",
  evidence,
  confidence: "medium",
});

describe("the steps behind a gap", () => {
  it("says what to do for a skill the resume doesn't show, and advises being ready to back it up", () => {
    const help = stepsForGap(verdict("skill", "missing"), "Docker in production");
    assert.equal(help.status, "missing");
    assert.equal(help.weight, "Required");
    assert.equal(help.closest, null);
    assert.equal(help.actions[0].label, "Add a bullet");
    assert.match(help.actions[0].how, /^Under your most relevant role, show “Docker in production”/);
    assert.deepEqual(
      help.actions.find((action) => action.label === "Add it to Skills"),
      { label: "Add it to Skills", how: "Add “Docker in production” to your Skills list." },
    );
    assert.equal(help.advice, INTERVIEW_ADVICE);
    // What to do, never whether to (owner, 2026-10-03).
    assert.ok(help.actions.every((action) => !/leave it off|only if/i.test(action.how)));
  });

  it("calls a long requirement “it”, and never suggests it for the Skills list", () => {
    const help = stepsForGap(verdict("skill", "missing"), "Experience running large distributed systems in production");
    assert.match(help.actions[0].how, /show it:/);
    assert.ok(help.actions.every((action) => action.label !== "Add it to Skills"));
  });

  it("keeps every pill short", () => {
    for (const category of ["skill", "experience", "education", "responsibility", "leadership"]) {
      for (const state of ["missing", "partial"]) {
        const help = stepsForGap(verdict(category, state, [{ chunkId: "c1", text: "Ran ECS", section: "experience", role: "Kite", score: 0.5 }]), "Docker");
        for (const action of help.actions) assert.ok(action.label.split(" ").length <= 5, action.label);
      }
    }
  });

  it("starts from the closest line when the resume partly covers it", () => {
    const help = stepsForGap(
      verdict("experience", "partial", [
        { chunkId: "c1", text: "Ran containers on ECS", section: "experience", role: "Kite", score: 0.4 },
        { chunkId: "c2", text: "Wrote a Dockerfile once", section: "experience", role: "Acme", score: 0.7 },
      ]),
      "Docker in production",
    );
    assert.equal(help.status, "partial");
    assert.deepEqual(help.closest, { text: "Wrote a Dockerfile once", role: "Acme" });
    assert.equal(help.actions[0].label, "Build on that line");
    // Something on the resume comes close: no advice needed.
    assert.equal(help.advice, null);
  });

  it("has steps for education and responsibilities too, and treats an unknown category as experience", () => {
    assert.equal(stepsForGap(verdict("education", "missing"), "BSc").actions[0].label, "Add it under Education");
    assert.equal(stepsForGap(verdict("responsibility", "missing"), "on-call").actions[0].label, "Add a bullet");
    assert.match(stepsForGap(verdict("leadership", "missing"), "x").actions[0].how, /most relevant role/);
  });

  it("never uses an em dash", () => {
    for (const category of ["skill", "experience", "education", "responsibility", "leadership"]) {
      for (const state of ["missing", "partial"]) {
        const help = stepsForGap(verdict(category, state, [{ chunkId: "c1", text: "Ran ECS", section: "experience", role: "Kite", score: 0.5 }]), "Docker");
        for (const line of [...help.actions.flatMap((action) => [action.label, action.how]), help.advice ?? ""]) assert.ok(!line.includes("—"), line);
      }
    }
  });

  it("quotes only the sentence of a long closest line that is about the requirement", () => {
    const summary =
      "Fullstack engineer with half a decade of experience building production systems. Passionate about usable software at scale. " +
      "Improved authentication security and system reliability through code reviews and debugging sessions. Mentors juniors.";
    assert.equal(
      excerpt(summary, "Experience implementing quality standards, including accessibility, security, and reliability"),
      "Improved authentication security and system reliability through code reviews and debugging sessions.",
    );
    // One very long sentence is cut at a word, with an ellipsis.
    const long = `Built ${"scalable reliable ".repeat(20)}systems.`;
    const cut = excerpt(long, "reliable systems");
    assert.ok(cut.length <= 181, String(cut.length));
    assert.ok(cut.endsWith("…"));
    assert.ok(!/\s…$/.test(cut));
  });
});

describe("what tailoring changed", () => {
  it("finds new summary sentences, added skills, reworded bullets and a new title", () => {
    const before = content();
    const after = content({
      title: "Senior Product Designer",
      summary: "Designer with six years in fintech. Builds accessible design systems at scale.",
      skills: ["Figma", "Research", "Accessibility"],
      experience: [{ ...before.experience[0], bullets: ["Led the checkout redesign", "Ran usability research with 40 users"] }],
    });
    const changes = resumeChanges(before, after);
    assert.deepEqual(changes.summary, ["Builds accessible design systems at scale."]);
    assert.deepEqual(changes.skills, ["Accessibility"]);
    assert.deepEqual(changes.bullets, ["Ran usability research with 40 users"]);
    assert.equal(changes.title, "Senior Product Designer");
    assert.equal(changeCount(changes), 4);
    // Longest first, so a sentence wins over a skill inside it.
    assert.deepEqual(highlightTexts(changes), [
      "Builds accessible design systems at scale.",
      "Ran usability research with 40 users",
      "Senior Product Designer",
      "Accessibility",
    ]);
  });

  it("does not count case or spacing as a change, and sees nothing changed between equals", () => {
    const before = content();
    assert.equal(changeCount(resumeChanges(before, content({ skills: ["figma", " Research "] }))), 0);
    assert.equal(changeCount(resumeChanges(before, before)), 0);
  });

  it("treats everything as new when there is nothing to compare with", () => {
    const changes = resumeChanges(null, content());
    assert.equal(changes.summary.length, 2);
    assert.equal(changes.skills.length, 2);
  });
});

describe("the score card", () => {
  it("colours a score from red through yellow to a vivid green", () => {
    assert.equal(scoreColor(0), "hsl(0 85% 50%)");
    assert.equal(scoreColor(50), "hsl(60 85% 50%)");
    assert.equal(scoreColor(100), "hsl(120 85% 40%)");
    assert.equal(scoreColor(-5), scoreColor(0));
    assert.equal(scoreColor(140), scoreColor(100));
    assert.equal(scoreColor(Number.NaN), scoreColor(0));
  });

  it("sets apart the first “N of M” in a scoring note", () => {
    assert.deepEqual(noteParts("9 of 14 requirements were scored on embedding similarity alone."), [
      { text: "9", kind: "count" },
      { text: " of ", kind: "plain" },
      { text: "14", kind: "total" },
      { text: " requirements were scored on embedding similarity alone.", kind: "plain" },
    ]);
    assert.deepEqual(
      noteParts("Only 3 of 14 could be checked").map((part) => part.kind),
      ["plain", "count", "plain", "total", "plain"],
    );
    assert.deepEqual(noteParts("No numbers here."), [{ text: "No numbers here.", kind: "plain" }]);
  });

  it("picks out quantities with their units, but not years, codes or time zones", () => {
    const picked = (text) => quantityParts(text).filter((part) => part.quantity).map((part) => part.text);
    assert.deepEqual(picked("5+ years of experience building and scaling SaaS products"), ["5+ years"]);
    assert.deepEqual(picked("Routes 2M messages a day, cutting latency by 40% in 3 weeks"), ["2M", "40%", "3 weeks"]);
    assert.deepEqual(picked("Software Engineer [IC3], UTC-8 to UTC+2, since 2019"), []);
    assert.deepEqual(quantityParts("No numbers here."), [{ text: "No numbers here.", quantity: false }]);
    assert.equal(
      quantityParts("Cut costs by 30% this year")
        .map((part) => part.text)
        .join(""),
      "Cut costs by 30% this year",
    );
  });

  it("takes em dashes out and leaves en dashes in dates alone", () => {
    assert.equal(withoutEmDashes("Strong match — but missing Docker — so fix that."), "Strong match, but missing Docker, so fix that.");
    assert.equal(withoutEmDashes("— framed —"), "framed");
    assert.equal(withoutEmDashes("Ends on a dash —."), "Ends on a dash.");
    assert.equal(withoutEmDashes("Kite, 2020 – 2024"), "Kite, 2020 – 2024");
  });
});
