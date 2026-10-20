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

const { EMPTY_APPLY_STATE, readApplyState, readStep, readVisited, scanBaseline, sendingResumeId, textPrint } = await import("../app/lib/apply/state.ts");
const { INTERVIEW_ADVICE, excerpt, stepsForGap } = await import("../app/lib/apply/gapSteps.ts");
const { changeCount, highlightTexts, resumeChanges } = await import("../app/lib/apply/changes.ts");
const { noteParts, quantityParts, scoreColor, withoutEmDashes } = await import("../app/lib/apply/score.ts");
const { editBullet, editSummary } = await import("../app/lib/apply/edits.ts");
const { MAX_HISTORY_STEPS, REPORTS_KEPT, hiddenLabel, pushStep, scoreOfScan, scoreStep, stampStep, undoIfWorse } = await import("../app/lib/apply/history.ts");
const {
  TRIED,
  bareBullets,
  keepProof,
  languageAsk,
  matchesEnough,
  provedIn,
  workedIn,
  worthAdding,
  worthGapChip,
  fitGap,
  bulletsWithoutResult,
  fixFirstId,
  matchMoves,
  onlyInSkills,
  scoreHue,
  skillsOnlyNames,
  unbackedSkills,
  workingItems,
} = await import("../app/lib/apply/fixes.ts");
const { impactMisses, openingWord } = await import("../app/lib/apply/impact.ts");

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

const report = {
  scanId: "s1",
  resumeVersion: 2,
  score: 61,
  metrics: [],
  gaps: [],
  verdicts: [],
  degraded: false,
  degradedReason: null,
  explanation: null,
  rewrites: [],
};

describe("reading a session's state", () => {
  it("answers the defaults for nothing, or for something that isn't an object", () => {
    assert.deepEqual(readApplyState(undefined), EMPTY_APPLY_STATE);
    assert.deepEqual(readApplyState("junk"), EMPTY_APPLY_STATE);
    assert.deepEqual(readApplyState([]), EMPTY_APPLY_STATE);
  });

  it("reads back what the wizard wrote", () => {
    const written = {
      resume: {
        baseId: "b1",
        baseName: "cv.pdf",
        draftId: "d1",
        draftName: "cv — Acme",
        draftFromId: "b1",
        sendDraft: true,
        creatorDocId: null,
        creatorSeen: null,
        history: [],
        historyAt: 0,
        worked: [],
        asks: [{ term: "HubSpot", ifTrue: "HubSpot, if you have used it", place: "skills", fromStep: "s-1", no: false, addedIn: null }],
        fitAt: "s-1",
      },
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

  it("keeps every pill short, and each one a different thing to do", () => {
    for (const category of ["skill", "experience", "education", "responsibility", "leadership"]) {
      for (const state of ["missing", "partial"]) {
        const help = stepsForGap(
          verdict(category, state, [{ chunkId: "c1", text: "Ran ECS", section: "experience", role: "Kite", score: 0.5 }]),
          "Docker",
        );
        for (const action of help.actions) assert.ok(action.label.split(" ").length <= 5, action.label);
        // The posting's wording is said once, inside the step it belongs to (owner, 2026-10-03).
        const wording = help.actions.filter((action) => /posting/.test(action.label) || /posting/.test(action.how));
        assert.ok(wording.length <= 1, `${category}/${state}: ${wording.map((action) => action.label).join(", ")}`);
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
        const help = stepsForGap(
          verdict(category, state, [{ chunkId: "c1", text: "Ran ECS", section: "experience", role: "Kite", score: 0.5 }]),
          "Docker",
        );
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
    const picked = (text) =>
      quantityParts(text)
        .filter((part) => part.quantity)
        .map((part) => part.text);
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

const step = (id, extra = {}) => ({ id, label: id, at: "2026-10-19T10:00:00.000Z", content: content(), version: null, score: null, ...extra });

describe("the draft's change history", () => {
  it("adds a change after the current step and clears the undone ones", () => {
    const three = [step("a"), step("b"), step("c")];
    const pushed = pushStep(three, 0, step("d"));
    assert.deepEqual(
      pushed.history.map((row) => row.id),
      ["a", "d"],
    );
    assert.equal(pushed.at, 1);
    assert.equal(pushStep(three, 2, step("e")).at, 3);
  });

  it("keeps the starting point and the latest steps, and reports on the latest few only", () => {
    let history = [step("start", { report })];
    let at = 0;
    for (let i = 1; i <= MAX_HISTORY_STEPS + 3; i += 1) ({ history, at } = pushStep(history, at, step(`s${i}`, { report })));
    assert.equal(history.length, MAX_HISTORY_STEPS);
    assert.equal(history[0].id, "start");
    assert.equal(history.at(-1).id, `s${MAX_HISTORY_STEPS + 3}`);
    assert.equal(at, MAX_HISTORY_STEPS - 1);
    assert.equal(history.filter((row) => row.report).length, REPORTS_KEPT);
  });

  it("gives a scanned version's step its score", () => {
    const history = [step("a", { version: 1 }), step("b", { version: 2 })];
    const scored = scoreStep(history, 2, { ...report, score: 72.4 });
    assert.equal(scored[1].score, 72);
    assert.equal(scored[0].score, null);
    assert.equal(scoreStep(history, 9, report), history);
  });

  it("says what changing the hidden parts did", () => {
    const words = content();
    assert.equal(hiddenLabel([], ["summary"], words), "Hid Summary for this job");
    assert.equal(hiddenLabel(["skills"], [], words), "Showed Skills again");
    assert.equal(hiddenLabel([], ["exp:x1:0"], words), "Hid a line at Kite for this job");
    assert.equal(hiddenLabel([], ["exp:x1"], words), "Hid Kite for this job");
    assert.equal(hiddenLabel([], ["summary", "skills"], words), "Changed what's hidden for this job");
  });
});

describe("the score card's fixes", () => {
  const verdict = (id, state, sections) => ({
    requirement: { id, text: `Wants ${id}`, label: id, category: "skill", importance: "required" },
    state,
    evidence: sections.map((section) => ({ section, text: `${id} in ${section}` })),
  });

  it("colours a score by the design's bands", () => {
    assert.equal(scoreHue(49), "low");
    assert.equal(scoreHue(50), "mid");
    assert.equal(scoreHue(70), "high");
  });

  it("picks the lowest check to fix first, while it is under 65", () => {
    const metrics = (values) => values.map(([id, value]) => ({ id, value }));
    assert.equal(
      fixFirstId({
        metrics: metrics([
          ["keyword-match", 80],
          ["impact-language", 41],
        ]),
      }),
      "impact-language",
    );
    assert.equal(
      fixFirstId({
        metrics: metrics([
          ["keyword-match", 80],
          ["impact-language", 70],
        ]),
      }),
      null,
    );
  });

  it("finds keywords matched only in Skills", () => {
    const verdicts = [
      verdict("Docker", "satisfied", ["skills"]),
      verdict("Go", "satisfied", ["skills", "experience"]),
      verdict("AWS", "missing", []),
    ];
    assert.deepEqual(
      verdicts.filter(onlyInSkills).map((v) => v.requirement.id),
      ["Docker"],
    );
    assert.deepEqual(skillsOnlyNames({ verdicts }), ["Docker"]);
  });

  it("says what a change newly matched", () => {
    const now = { verdicts: [verdict("Docker", "satisfied", ["experience"]), verdict("Go", "satisfied", ["skills"])] };
    const moves = matchMoves(now, { Docker: "missing", Go: "satisfied" });
    assert.equal(moves.length, 1);
    assert.equal(moves[0].name, "Docker");
    assert.equal(moves[0].up, true);
    assert.equal(moves[0].where, "Experience");
    assert.deepEqual(matchMoves(now, undefined), []);
  });

  it("counts bullets with no result and lists what is working", () => {
    const words = content({
      experience: [{ id: "x1", role: "Designer", company: "Kite", dates: "", bullets: ["Grew signups 40%", "Ran research", " "] }],
    });
    assert.equal(bulletsWithoutResult(words), 1);
    const items = workingItems({ metrics: [{ id: "parseability", value: 91 }], verdicts: [] }, words);
    assert.deepEqual(
      items.map((item) => item.title),
      ["Reads cleanly.", "Numbers on 1 bullet."],
    );
  });
});

describe("the points-off note", () => {
  it("names the posting's skills in Skills that no role or project mentions", () => {
    const req = (label, category = "skill") => ({
      requirement: { id: label, text: label, label, category, importance: "required" },
      state: "satisfied",
      evidence: [],
    });
    const words = content({
      skills: ["Figma", "Okta", "MDM rollout", "Jamf"],
      experience: [{ id: "x1", role: "IT lead", company: "Kite", dates: "", bullets: ["Rolled out Okta to 300 staff"] }],
      projects: [{ id: "p1", name: "Fleet", detail: "Moved laptops to Jamf" }],
    });
    assert.deepEqual(unbackedSkills(words, { verdicts: [req("Okta"), req("MDM rollout"), req("Jamf"), req("Terraform")] }), ["MDM rollout"]);
  });
});

describe("stamping the step the draft is at", () => {
  it("gives the current step this score, whatever version it was recorded with", () => {
    const history = [step("a", { version: 1, score: 31 }), step("b", { version: 4, score: 31 })];
    const stamped = stampStep(history, 1, 7, { ...report, score: 45 });
    assert.equal(stamped[1].score, 45);
    assert.equal(stamped[1].version, 7);
    assert.equal(stamped[0].score, 31);
    assert.equal(stampStep([], 0, 7, report).length, 0);
  });
});

describe("editing lines on the page", () => {
  it("retypes a line, and says where", () => {
    const edit = editBullet(content(), "x1", 1, "Ran research with 12 users");
    assert.equal(edit.label, "Edited a line at Kite");
    assert.deepEqual(edit.content.experience[0].bullets, ["Led the checkout redesign", "Ran research with 12 users"]);
    assert.equal(editBullet(content(), "x1", 1, " Ran research "), null);
    assert.equal(editBullet(content(), "nope", 0, "x"), null);
  });

  it("deletes an emptied line and moves the hidden marks after it up one", () => {
    const words = content({
      experience: [{ id: "x1", role: "Designer", company: "Kite", dates: "", bullets: ["a", "b", "c"] }],
      hiddenParts: ["exp:x1:0", "exp:x1:2", "summary"],
    });
    const edit = editBullet(words, "x1", 0, "  ");
    assert.equal(edit.label, "Deleted a line at Kite");
    assert.deepEqual(edit.content.experience[0].bullets, ["b", "c"]);
    assert.deepEqual(edit.content.hiddenParts, ["exp:x1:1", "summary"]);
  });

  it("retypes the summary", () => {
    assert.equal(editSummary(content(), "New words.").label, "Edited the Summary");
    assert.equal(editSummary(content(), content().summary), null);
  });
});

describe("cards never point at what is hidden", () => {
  it("leaves hidden roles and lines out of the bullets with no result", () => {
    const words = content({
      experience: [
        { id: "x1", role: "Designer", company: "Kite", dates: "", bullets: ["Ran research", "Led the redesign", "Grew signups 40%"] },
        { id: "x2", role: "Intern", company: "Owl", dates: "", bullets: ["Made coffee"] },
      ],
      hiddenParts: ["exp:x1:1", "exp:x2"],
    });
    assert.deepEqual(bareBullets(words), ["Ran research"]);
    assert.equal(bulletsWithoutResult(words), 1);
  });
});

describe("AI changes keep what proves a requirement", () => {
  const verdict = (label, state, text, section = "experience", proof = []) => ({
    requirement: { id: label, text: `Needs ${label}`, label, category: "skill", type: "required", weight: 3, proof },
    state,
    score: 0.9,
    resolvedBy: "rerank",
    evidence: [{ chunkId: "c1", text, section, role: null, score: 0.9 }],
    confidence: "high",
  });
  const before = content({
    experience: [{ id: "x1", role: "CSM", company: "Kite", dates: "", bullets: ["Wrote copywriting for onboarding emails", "Ran research"] }],
  });

  it("puts back a proving line the change rewrote away, and keeps the rest of the change", () => {
    const after = content({
      experience: [{ id: "x1", role: "CSM", company: "Kite", dates: "", bullets: ["Grew activation 20% with lifecycle emails", "Ran research with 30 users"] }],
    });
    const result = keepProof(before, after, { verdicts: [verdict("Copywriting", "satisfied", "Wrote copywriting for onboarding emails", "experience", ["copy", "copywriting"])] });
    assert.deepEqual(result.content.experience[0].bullets, ["Wrote copywriting for onboarding emails", "Ran research with 30 users"]);
    assert.deepEqual(result.kept, ["Copywriting"]);
  });

  it("keeps a rewrite that still says what proved it", () => {
    const after = content({
      experience: [{ id: "x1", role: "CSM", company: "Kite", dates: "", bullets: ["Wrote copywriting for 12 onboarding emails", "Ran research"] }],
    });
    const result = keepProof(before, after, { verdicts: [verdict("Copywriting", "satisfied", "Wrote copywriting for onboarding emails")] });
    assert.equal(result.content.experience[0].bullets[0], "Wrote copywriting for 12 onboarding emails");
    assert.deepEqual(result.kept, []);
  });

  it("leaves missing requirements alone", () => {
    const after = content({ experience: [{ id: "x1", role: "CSM", company: "Kite", dates: "", bullets: ["Something new", "Ran research"] }] });
    const result = keepProof(before, after, { verdicts: [verdict("Copywriting", "missing", "Wrote copywriting for onboarding emails")] });
    assert.equal(result.content, after);
  });
});

describe("a language level the posting asks for", () => {
  const ask = (state, text = "English from B2: written and spoken", label = "English proficiency") => ({
    verdicts: [{ requirement: { id: "en", text, label, category: "skill", type: "required", weight: 5 }, state, evidence: [] }],
  });

  it("is named, with the level the posting asks for, when the resume never states it", () => {
    assert.deepEqual(languageAsk(ask("missing"), content()), { language: "English", level: "B2" });
    assert.deepEqual(languageAsk(ask("partial"), content()), { language: "English", level: "B2" });
  });

  it("says nothing when the resume already states it, or the requirement is met", () => {
    assert.equal(languageAsk(ask("missing"), content({ skills: ["Figma", "English: native"] })), null);
    assert.equal(languageAsk(ask("satisfied"), content()), null);
    assert.equal(languageAsk(ask("missing", "Experience with Zendesk", "Zendesk experience"), content()), null);
  });

  it("still asks when the resume names the language with no level, which the scorer can't count", () => {
    assert.deepEqual(languageAsk(ask("partial"), content({ skills: ["Figma", "English"] })), { language: "English", level: "B2" });
    assert.equal(languageAsk(ask("partial"), content({ skills: ["Figma", "English (C1)"] })), null);
  });
});

describe("what Impact language marks down", () => {
  const role = (bullets, extra = {}) => ({ id: "x1", role: "CSM", company: "Kite", dates: "2022 – 2024", bullets, ...extra });

  it("names each bullet that opens weakly or has no number, as the scorer reads them", () => {
    const misses = impactMisses(
      content({
        experience: [
          role([
            "Held a 4.8/5 average rating on onboarding calls.",
            "Acted as a trusted advisor to customers.",
            "Partner directly with leadership on retention strategy.",
            "Grew renewals 20% across 80 accounts.",
            "Grow renewals 20% across 80 accounts.",
            "Led onboarding in 2021.",
          ]),
        ],
      }),
    );
    assert.deepEqual(misses.weakOpeners, ["Held a 4.8/5 average rating on onboarding calls.", "Acted as a trusted advisor to customers."]);
    assert.deepEqual(misses.noNumber, ["Acted as a trusted advisor to customers.", "Partner directly with leadership on retention strategy.", "Led onboarding in 2021."]);
    assert.equal(misses.lines.length, 4);
    assert.equal(openingWord("Acted as a trusted advisor."), "Acted");
  });

  it("never reads a role or a line hidden for this job", () => {
    const misses = impactMisses(
      content({ experience: [role(["Acted as an advisor.", "Took tickets from 45 to 35."])], hiddenParts: ["exp:x1:0"] }),
    );
    assert.deepEqual(misses.lines, ["Took tickets from 45 to 35."]);
  });
});

// Owner, 2026-10-19: the score is 70% keyword match, 15% impact, 10% parseability and 5% length,
// no longer keyword match alone. A session saved before then still holds the old numbers.
describe("scores made by an older formula", () => {
  const metricsOf = (keyword, impact, parse, length) => [
    { id: "keyword-match", label: "Keyword match", value: keyword },
    { id: "impact-language", label: "Impact language", value: impact },
    { id: "parseability", label: "Parseability", value: parse },
    { id: "length-format", label: "Length & format", value: length },
  ];
  // Today's formula makes round(56 + 3 + 7 + 3) = 69 of these; the old one said 80, the keyword match.
  const oldReport = { ...report, scanId: "old", score: 80, metrics: metricsOf(80, 20, 70, 60) };
  const newReport = { ...report, scanId: "new", score: 69, metrics: metricsOf(80, 20, 70, 60) };
  const basisOf = (scored) => ({ metrics: scored.metrics, stuffingPenalty: 0 });

  it("reads a history step's score only when today's formula made it, never worked out again", () => {
    const { history } = readApplyState({
      resume: {
        history: [
          step("old", { version: 1, score: 80, report: oldReport }),
          step("new", { version: 2, score: 69, report: newReport }),
          // Its report was dropped before a basis was kept: nothing to tell it by.
          step("bare", { version: 3, score: 75 }),
          step("kept", { version: 4, score: 69, basis: basisOf(newReport) }),
          step("stale", { version: 5, score: 80, basis: basisOf(oldReport) }),
        ],
        historyAt: 4,
      },
    }).resume;
    assert.deepEqual(
      history.map((row) => row.score),
      [null, 69, null, 69, null],
    );
    assert.equal(history[0].report, null);
    assert.equal(history[1].report?.scanId, "new");
    assert.deepEqual(history[3].basis, basisOf(newReport));
    assert.equal(history[4].basis, undefined);
  });

  it("keeps what a score was made from when its report is dropped for room, so a reload still shows it", () => {
    let history = [step("start", { score: 69, report: newReport })];
    let at = 0;
    for (let i = 1; i <= REPORTS_KEPT; i += 1) ({ history, at } = pushStep(history, at, step(`s${i}`, { score: 69, report: newReport })));
    assert.equal(history[0].report, null);
    assert.deepEqual(history[0].basis, basisOf(newReport));
    const read = readApplyState(JSON.parse(JSON.stringify({ resume: { history, historyAt: at } }))).resume.history;
    assert.deepEqual(
      read.map((row) => row.score),
      history.map(() => 69),
    );
  });

  it("never stamps or scores a step with a report an older formula made", () => {
    const history = [step("a", { version: 1 }), step("b", { version: 2, score: 69, report: newReport })];
    assert.equal(stampStep(history, 1, 3, oldReport), history);
    assert.equal(scoreStep(history, 1, oldReport), history);
    assert.deepEqual(scoreOfScan(oldReport), { score: null, report: null });
    assert.deepEqual(scoreOfScan({ ...newReport, degraded: true }), { score: null, report: null });
    assert.deepEqual(scoreOfScan(null), { score: null, report: null });
    assert.deepEqual(scoreOfScan(newReport), { score: 69, report: newReport });
  });

  it("measures a new score against the last version scored, never across formulas", () => {
    const last = (scored, extra = {}) => ({ resumeId: "d1", version: 2, report: { ...scored, verdicts: [verdict("skill", "partial")] }, ...extra });
    const current = last(newReport, { previousScore: 61, previousMetrics: { "keyword-match": 70 } });
    assert.deepEqual(scanBaseline(current, "d1", 3), {
      previousScore: 69,
      previousStates: { r1: "partial" },
      previousMetrics: { "keyword-match": 80, "impact-language": 20, parseability: 70, "length-format": 60 },
    });
    // A re-run of the same version keeps what it was measured against.
    assert.deepEqual(scanBaseline(current, "d1", 2), { previousScore: 61, previousMetrics: { "keyword-match": 70 } });
    // Stored as 80 and rescored as 73 is the formula, not "Down 7": nothing is said to have moved.
    assert.deepEqual(scanBaseline(last(oldReport, { previousScore: 61 }), "d1", 3), { previousScore: null });
    assert.deepEqual(scanBaseline(last(oldReport, { previousScore: 61 }), "d1", 2), { previousScore: null });
    assert.deepEqual(scanBaseline(last({ ...newReport, degraded: true }, { previousScore: 61 }), "d1", 3), { previousScore: null });
    assert.deepEqual(scanBaseline(null, "d1", 3), { previousScore: null });
  });
});

describe("a duty is work to reframe, never a keyword chip (owner, 2026-10-20)", () => {
  const duty = { state: "missing", score: 0, evidence: [], requirement: { id: "d", text: "Own month-end reconciliation", label: "Month-end reconciliation", type: "required", category: "responsibility", weight: 4, proof: [] } };
  const skill = { ...duty, requirement: { ...duty.requirement, id: "s", text: "NetSuite", label: "NetSuite", category: "skill" } };

  it("gives a missing duty no chip, and keeps it for Tailor to this job", () => {
    assert.equal(worthGapChip(duty), false);
    assert.equal(fitGap(duty), true);
  });

  it("still gives a missing skill its chip", () => {
    assert.equal(worthGapChip(skill), true);
    assert.equal(fitGap(skill), true);
  });

  it("gives a disposition or a years-of-experience line no chip (owner, 2026-10-20: \"Phone comfort is not even a thing\")", () => {
    assert.equal(worthGapChip({ ...skill, requirement: { ...skill.requirement, label: "Phone comfort", text: "Comfortable picking up the phone" } }), false);
    assert.equal(worthGapChip({ ...skill, requirement: { ...skill.requirement, label: "Professional experience", category: "experience" } }), false);
  });

  it("gives Tailor nothing a nice-to-have asks", () => {
    assert.equal(fitGap({ ...duty, requirement: { ...duty.requirement, type: "preferred" } }), false);
  });
});

describe("what is worth a chip (owner, 2026-10-19: \"nothing left to add, move on\")", () => {
  const verdict = (state, type = "required", weight = 4) => ({ state, requirement: { id: "r", text: "x", type, category: "skill", weight } });

  it("asks for a required requirement that is missing, or partly shown and weighty", () => {
    assert.equal(worthAdding(verdict("missing")), true);
    assert.equal(worthAdding(verdict("missing", "required", 2)), true);
    assert.equal(worthAdding(verdict("partial", "required", 4)), true);
  });

  it("never asks for a nice-to-have, or a lighter one the work already partly shows", () => {
    assert.equal(worthAdding(verdict("partial", "preferred", 2)), false);
    assert.equal(worthAdding(verdict("missing", "preferred", 5)), false);
    assert.equal(worthAdding(verdict("partial", "required", 3)), false);
  });

  it("asks for nothing once keyword match reaches 90", () => {
    const at = (value, extra = {}) => ({ metrics: [{ id: "keyword-match", label: "Keyword match", value, ...extra }] });
    assert.equal(matchesEnough(at(93)), true);
    assert.equal(matchesEnough(at(90)), true);
    assert.equal(matchesEnough(at(89)), false);
    assert.equal(matchesEnough(at(null, { checked: false })), false);
  });
});

describe("keywords the AI already worked in (50-job run, 2026-10-19)", () => {
  const draft = content({
    experience: [{ id: "x1", role: "CSM", company: "Kite", dates: "", bullets: ["Managed 100+ premium enterprise accounts.", "Ran QBRs."] }],
    skills: ["Figma", "Multichannel communication"],
  });

  it("are not offered again while their lines stand, in a line or in Skills", () => {
    const worked = [
      { label: "Premium segment experience", lines: ["Managed 100+ premium enterprise accounts"] },
      { label: "Multichannel communication", lines: ["Skills"] },
      { label: "Churn prevention", lines: ["Cut churn to 2% across 80 accounts."] },
    ];
    assert.deepEqual([...workedIn(worked, draft)].sort(), ["multichannel communication", "premium segment experience"]);
  });

  it("count when the tool found them already there, whatever the hyphen, and when it could place them nowhere", () => {
    const there = content({
      experience: [{ id: "x1", role: "CSM", company: "Kite", dates: "", bullets: ["Worked with an agency on 3 launches.", "Ran QBRs."] }],
      skills: ["Cross-functional collaboration"],
    });
    const worked = [
      { label: "Cross‑functional collaboration", lines: ["Skills"] },
      { label: "Agency experience", lines: ["Skills"] },
      { label: "Rapid AI prototyping", lines: [TRIED, "bullets"] },
      { label: "Pipeline generation", lines: ["Skills"] },
    ];
    assert.deepEqual([...workedIn(worked, there, ["bullets"])].sort(), ["agency experience", "cross‑functional collaboration", "rapid ai prototyping"]);
  });

  // 50-job run, 2026-10-19: the AI read "Senior Product Designer ... design systems" as carrying the
  // term, the page did not, and the chip came back to change nothing.
  it("count one the AI found already there when one line or one skill has every word of it", () => {
    const there = content({
      summary: "Senior Product Designer with extensive experience in fintech, specializing in design systems.",
      experience: [{ id: "x1", role: "Designer", company: "Kite", dates: "", bullets: ["Led research for 3 products.", "Shipped the mobile app."] }],
      skills: ["Figma"],
    });
    const worked = [
      { label: "Senior product design experience", lines: ["Skills"] },
      { label: "Mobile app design", lines: ["Skills"] },
      { label: "Experience in user research", lines: ["Skills"] },
    ];
    // "Mobile app design": "mobile" and "app" are in a bullet, "design" only in another line.
    assert.deepEqual([...workedIn(worked, there)].sort(), ["senior product design experience"]);
  });

  // Review, 2026-10-19: a raw substring let a short skill stand for almost any term.
  it("count in Skills only as whole words, never inside another word or as a heading", () => {
    const listed = content({
      experience: [{ id: "x1", role: "CSM", company: "Kite", dates: "", bullets: ["Ran QBRs."] }],
      skills: ["AI", "C", "Go", "JavaScript", "Email marketing (HubSpot)"],
      skillGroups: [{ id: "g1", title: "Tools", skills: ["AI", "C", "Go", "JavaScript", "Email marketing (HubSpot)"] }],
    });
    const worked = [
      { label: "Google Ads", lines: ["Skills"] },
      { label: "Customer success", lines: ["Skills"] },
      { label: "Java", lines: ["Skills"] },
      { label: "Sales tools", lines: ["Skills"] },
      { label: "Email marketing", lines: ["Skills"] },
    ];
    assert.deepEqual([...workedIn(worked, listed)], ["email marketing"]);
  });

  // Review, 2026-10-19: one missed in a Bullets-only run was hidden for good.
  it("hide one the AI could not place only while the same places are picked, never for Skills alone", () => {
    const worked = [{ label: "Churn modelling", lines: [TRIED, "bullets"] }];
    assert.deepEqual([...workedIn(worked, draft, ["bullets"])], ["churn modelling"]);
    assert.deepEqual([...workedIn(worked, draft, ["bullets", "skills"])], []);
    assert.deepEqual([...workedIn(worked, draft, ["summary"])], []);
    assert.deepEqual([...workedIn(worked, draft, ["skills"])], []);
    // Tried with Skills on too: a Bullets-only run would not place it either.
    assert.deepEqual([...workedIn([{ label: "Churn modelling", lines: [TRIED, "bullets", "skills"] }], draft, ["bullets"])], ["churn modelling"]);
    // Saved before the places were kept: shown again.
    assert.deepEqual([...workedIn([{ label: "Churn modelling", lines: [TRIED] }], draft, ["bullets"])], []);
  });

  // Review, 2026-10-19: one that went into Skills for now, from a run without Bullets, had no chip at all.
  it("hide a proof chip only for one put in a line or tried in Bullets, never for Skills alone", () => {
    const listed = content({
      experience: [{ id: "x1", role: "CSM", company: "Kite", dates: "", bullets: ["Ran QBRs."] }],
      skills: ["Churn modelling"],
    });
    assert.deepEqual([...provedIn([{ label: "Churn modelling", lines: ["Skills"] }], listed)], []);
    assert.deepEqual([...provedIn([{ label: "Churn modelling", lines: ["Skills"] }, { label: "Churn modelling", lines: [TRIED, "summary"] }], listed)], []);
    assert.deepEqual([...provedIn([{ label: "Churn modelling", lines: ["Skills"] }, { label: "Churn modelling", lines: [TRIED, "bullets"] }], listed)], ["churn modelling"]);
    assert.deepEqual([...provedIn([{ label: "Churn modelling", lines: ["Ran QBRs."] }], listed)], ["churn modelling"]);
  });

  // Review, 2026-10-19: a summary is up to 900 characters, and a line cut at 400 never matched it again.
  it("keep a long summary they went into whole through a reload", () => {
    const summary = `${"Customer success lead who runs renewals and expansion for enterprise accounts. ".repeat(9)}`.trim();
    assert.ok(summary.length > 700);
    const long = content({ summary, experience: [{ id: "x1", role: "CSM", company: "Kite", dates: "", bullets: ["Ran QBRs."] }] });
    const state = readApplyState({ resume: { worked: [{ label: "Expansion", lines: [summary] }] } });
    assert.deepEqual([...workedIn(state.resume.worked, long)], ["expansion"]);
  });

  it("keep the places tried through a reload", () => {
    const state = readApplyState({ resume: { worked: [{ label: "Churn", lines: [TRIED, "bullets", "summary", "skills"] }] } });
    assert.deepEqual(state.resume.worked, [{ label: "Churn", lines: [TRIED, "bullets", "summary", "skills"] }]);
  });

  it("are kept in the session as they were saved, and nothing else", () => {
    const state = readApplyState({ resume: { worked: [{ label: "Premium", lines: ["A line."] }, { label: "", lines: ["x"] }, { label: "No lines", lines: [] }, "junk"] } });
    assert.deepEqual(state.resume.worked, [{ label: "Premium", lines: ["A line."] }]);
    assert.deepEqual(readApplyState({}).resume.worked, []);
  });
});

describe("chips that would add nothing (review, 2026-10-19)", () => {
  const verdict = (state, sections, type = "required", weight = 5) => ({
    requirement: { id: "r", text: "Multichannel communication", label: "Multichannel communication", type, category: "skill", weight },
    state,
    evidence: sections.map((section) => ({ section, text: `Multichannel communication in ${section}` })),
  });

  it("never shows a requirement only Skills shows as a Missing chip too: it is a proof chip", () => {
    assert.equal(worthGapChip(verdict("partial", ["skills"])), false);
    assert.equal(worthGapChip(verdict("partial", ["experience"])), true);
    assert.equal(worthGapChip(verdict("missing", [])), true);
    assert.equal(worthGapChip(verdict("missing", [], "preferred")), false);
    assert.equal(worthGapChip(undefined), true);
  });

  it("never asks for the level of a nice-to-have language, nor lets one take the ask from a required one", () => {
    const language = (id, text, type, weight = 5) => ({
      requirement: { id, text, label: text, category: "skill", type, weight },
      state: "missing",
      evidence: [],
    });
    assert.equal(languageAsk({ verdicts: [language("es", "Spanish is a plus", "preferred")] }, content()), null);
    assert.equal(languageAsk({ verdicts: [{ ...language("es", "Spanish", "required", 3), state: "partial" }] }, content()), null);
    assert.deepEqual(
      languageAsk({ verdicts: [language("es", "Spanish is a plus", "preferred"), language("en", "English at C1", "required")] }, content()),
      { language: "English", level: "C1" },
    );
  });
});

describe("a tool's change that scores lower (review, 2026-10-19)", () => {
  const scored = (score) => ({ ...report, score });
  const steps = (...scores) => scores.map((score, i) => step(`s${i}`, { version: i + 1, score }));

  it("goes back to the step before it, measured against that step's score", () => {
    const history = steps(70, 72);
    assert.equal(undoIfWorse(history, 1, "s1", scored(65)), 0);
    assert.equal(undoIfWorse(history, 1, "s1", scored(70)), null);
    assert.equal(undoIfWorse(history, 1, "s1", scored(71)), null);
  });

  it("never undoes once the draft has moved off it, by undo or by a change of the person's own", () => {
    const history = steps(70, 72, 60);
    // A hand edit made after it, now at step 2.
    assert.equal(undoIfWorse(history, 2, "s1", scored(50)), null);
    // Undone already: the draft is at step 0.
    assert.equal(undoIfWorse(history, 0, "s1", scored(50)), null);
    assert.equal(undoIfWorse(history, 1, "gone", scored(50)), null);
  });

  it("finds the change by its step once the history is full, where it does not land at at + 1", () => {
    let history = [step("start", { score: 70 })];
    let at = 0;
    for (let i = 1; i < MAX_HISTORY_STEPS; i += 1) ({ history, at } = pushStep(history, at, step(`s${i}`, { score: 70 })));
    const before = at;
    ({ history, at } = pushStep(history, at, step("tool")));
    assert.equal(at, before);
    assert.equal(undoIfWorse(history, at, "tool", scored(60)), at - 1);
  });

  it("decides nothing from a partly checked scan, an older formula's, or a step with no score", () => {
    const history = steps(70, 72);
    assert.equal(undoIfWorse(history, 1, "s1", { ...scored(40), degraded: true }), null);
    // Today's formula makes 69 of these checks: 40 is another formula's number.
    const old = {
      ...report,
      score: 40,
      metrics: [
        { id: "keyword-match", label: "Keyword match", value: 80 },
        { id: "impact-language", label: "Impact language", value: 20 },
        { id: "parseability", label: "Parseability", value: 70 },
        { id: "length-format", label: "Length & format", value: 60 },
      ],
    };
    assert.equal(undoIfWorse(history, 1, "s1", old), null);
    assert.equal(undoIfWorse(steps(null, 72), 1, "s1", scored(40)), null);
  });
});

describe("edits made in the resume creator (review, 2026-10-19)", () => {
  it("tell a changed copy from an unchanged one by a short fingerprint kept in the session", () => {
    const text = "Ada Obi\nProduct Designer\n\nSUMMARY\nDesigner with six years in fintech.";
    assert.equal(textPrint(text), textPrint(`${text}`));
    assert.notEqual(textPrint(text), textPrint(`${text} Ships design systems.`));
    assert.notEqual(textPrint("ab"), textPrint("ba"));
    assert.ok(textPrint(text.repeat(50)).length < 20);
    assert.equal(readApplyState({ resume: { creatorSeen: textPrint(text) } }).resume.creatorSeen, textPrint(text));
    assert.equal(readApplyState({ resume: { creatorSeen: 4 } }).resume.creatorSeen, null);
  });
});
