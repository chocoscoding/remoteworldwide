// "Fix tone & grammar" proposals on the resume screen (app/lib/resume/tone-fixes.ts): pinned to
// the line they are about, applied only while that line still reads as proposed, and told apart
// as waiting, in, set aside or overtaken by an edit.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as dates.test.mjs: Node resolves neither the `@/` alias nor an extensionless `./x`.

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

const { applyToneFix, lineNow, pinToneFixes, proposalState } = await import("../app/lib/resume/tone-fixes.ts");

const content = () => ({
  name: "",
  title: "",
  location: "",
  email: "",
  phone: "",
  portfolio: "",
  links: [],
  summary: "Engineer runing payments.",
  experience: [{ id: "exp-a", role: "Frontend Engineer", company: "Kite", dates: "", bullets: ["", "Leaded the team"] }],
  education: [{ id: "edu-a", school: "Unilag", degree: "B.Sc. Computr Science", dates: "" }],
  projects: [],
  certifications: [],
  skills: ["Typescript", "Go"],
  skillGroups: [{ id: "g", title: "Code", skills: ["Typescript", "Go"] }],
});

const FIXES = [
  { at: { field: "summary" }, before: "Engineer runing payments.", after: "Engineer running payments.", kind: "spelling" },
  // The service counts non-empty bullets: its bullet 0 is the stored bullet 1.
  { at: { field: "bullet", entryIndex: 0, bulletIndex: 0 }, before: "Leaded the team", after: "Led the team", kind: "grammar" },
  { at: { field: "skill", index: 0 }, before: "Typescript", after: "TypeScript", kind: "capitalisation" },
  { at: { field: "degree", index: 0 }, before: "B.Sc. Computr Science", after: "B.Sc. Computer Science", kind: "spelling" },
  { at: { field: "project", index: 3 }, before: "x", after: "y", kind: "spelling" },
];

describe("pinning proposals to the page", () => {
  it("pins each to its line by what it is, and drops one naming a line that is not there", () => {
    const pinned = pinToneFixes(content(), FIXES);
    assert.deepEqual(pinned.map((p) => p.where), [
      { field: "summary" },
      { field: "bullet", entryId: "exp-a", index: 1 },
      { field: "skill", skill: "Typescript" },
      { field: "degree", entryId: "edu-a" },
    ]);
    assert.deepEqual(pinned.map((p) => p.label), ["Summary", "Frontend Engineer", "Skills", "Unilag"]);
    assert.deepEqual(pinned[1].ranges, [[0, 6]]);
  });
});

describe("applying one", () => {
  it("changes its line, the skill in its group too, and nothing else", () => {
    const start = content();
    const [summary, bullet, skill, degree] = pinToneFixes(start, FIXES);
    let now = applyToneFix(start, summary);
    now = applyToneFix(now, bullet);
    now = applyToneFix(now, skill);
    now = applyToneFix(now, degree);
    assert.equal(now.summary, "Engineer running payments.");
    assert.deepEqual(now.experience[0].bullets, ["", "Led the team"]);
    assert.deepEqual(now.skills, ["TypeScript", "Go"]);
    assert.deepEqual(now.skillGroups[0].skills, ["TypeScript", "Go"]);
    assert.equal(now.education[0].degree, "B.Sc. Computer Science");
    assert.equal(lineNow(now, bullet.where), "Led the team");
  });

  it("leaves a line edited since alone", () => {
    const start = content();
    const [summary] = pinToneFixes(start, FIXES);
    const edited = { ...start, summary: "Something else now." };
    assert.equal(applyToneFix(edited, summary), edited);
  });
});

describe("what became of one", () => {
  it("is waiting, in, set aside, or overtaken", () => {
    const start = content();
    const [summary, , skill] = pinToneFixes(start, FIXES);
    assert.equal(proposalState(start, summary, []), "pending");
    assert.equal(proposalState(start, summary, [summary.key]), "dismissed");
    assert.equal(proposalState(applyToneFix(start, summary), summary, []), "applied");
    assert.equal(proposalState({ ...start, summary: "Rewritten by hand." }, summary, []), "gone");
    assert.equal(proposalState(applyToneFix(start, skill), skill, []), "applied");
  });
});

describe("a custom section's point", () => {
  it("is pinned by its section's id and stored index, labelled with its name, and applied there", () => {
    const start = {
      ...content(),
      customSections: [{ id: "custom-1", title: "Volunteering", items: ["", "Organised monthly meetups"] }],
    };
    // The service counts non-empty points: its point 0 is the stored point 1.
    const [point] = pinToneFixes(start, [
      { at: { field: "point", customId: "custom-1", index: 0 }, before: "Organised monthly meetups", after: "Organised monthly meet-ups", kind: "spelling" },
      { at: { field: "point", customId: "custom-9", index: 0 }, before: "x", after: "y", kind: "spelling" },
    ]);
    assert.deepEqual(point.where, { field: "point", customId: "custom-1", index: 1 });
    assert.equal(point.label, "Volunteering");
    const now = applyToneFix(start, point);
    assert.deepEqual(now.customSections[0].items, ["", "Organised monthly meet-ups"]);
    assert.equal(proposalState(now, point, []), "applied");
  });
});
