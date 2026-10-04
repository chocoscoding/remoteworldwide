// Skills as one list or as sub skills (app/lib/resume/skills.ts): the flat
// list stays the whole truth in both modes, switching keeps every skill, and
// the groups follow when something that only knows the list (Tailor, Add
// missing keywords) changes it.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// The module imports types only, so no resolve hook is needed.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { addSkills, flattenGroups, hasSkill, isGrouped, printableGroups, reconcileGroups, skillLine, toFlat, toGrouped, withGroups } = await import(
  "../app/lib/resume/skills.ts"
);

const base = { name: "", skills: ["React", "Figma"] };
const group = (id, title, skills) => ({ id, title, skills });

describe("switching between All and Sub skills", () => {
  it("puts every skill in one untitled group on the way in", () => {
    const grouped = toGrouped(base, "skg-1");
    assert.ok(isGrouped(grouped));
    assert.deepEqual(grouped.skillGroups, [group("skg-1", "", ["React", "Figma"])]);
    assert.deepEqual(grouped.skills, ["React", "Figma"]);
  });

  it("keeps every skill and drops the titles on the way out", () => {
    const grouped = withGroups(base, [group("a", "Code", ["React"]), group("b", "Design", ["Figma", "Sketch"])]);
    const flat = toFlat(grouped);
    assert.equal(isGrouped(flat), false);
    assert.equal("skillGroups" in flat, false);
    assert.deepEqual(flat.skills, ["React", "Figma", "Sketch"]);
  });

  it("leaves a plain list alone", () => {
    assert.equal(toFlat(base), base);
    assert.equal(reconcileGroups(base), base);
  });
});

describe("keeping the flat list and the groups in step", () => {
  it("lists each skill once, in group order, whatever its case", () => {
    assert.deepEqual(flattenGroups([group("a", "", ["React", "Go"]), group("b", "", ["react", " ", "Figma"])]), ["React", "Go", "Figma"]);
  });

  it("drops a skill the list lost and puts a new one in the last group", () => {
    const grouped = withGroups(base, [group("a", "Code", ["React", "Vue"]), group("b", "Design", ["Figma"])]);
    const tailored = reconcileGroups({ ...grouped, skills: ["React", "Figma", "TypeScript"] });
    assert.deepEqual(tailored.skillGroups, [group("a", "Code", ["React"]), group("b", "Design", ["Figma", "TypeScript"])]);
    assert.deepEqual(tailored.skills, ["React", "Figma", "TypeScript"]);
  });

  it("starts an untitled group when there is none to add to", () => {
    const fixed = reconcileGroups({ ...base, skillGroups: [] });
    assert.deepEqual(fixed.skillGroups.map((g) => g.skills), [["React", "Figma"]]);
  });

  it("returns the same content when nothing was out of step", () => {
    const grouped = withGroups(base, [group("a", "Code", ["React"]), group("b", "Design", ["Figma"])]);
    assert.equal(reconcileGroups(grouped), grouped);
  });
});

describe("adding a keyword to Skills", () => {
  it("adds it to the end of a plain list, once whatever its case", () => {
    const added = addSkills(base, ["HubSpot", "react"]);
    assert.deepEqual(added.skills, ["React", "Figma", "HubSpot"]);
    assert.ok(hasSkill(added, "hubspot"));
    assert.equal(addSkills(base, ["figma"]), base);
  });

  it("puts it in the last sub skill group", () => {
    const grouped = withGroups(base, [group("a", "Code", ["React"]), group("b", "Design", ["Figma"])]);
    const added = addSkills(grouped, ["HubSpot"]);
    assert.deepEqual(added.skillGroups, [group("a", "Code", ["React"]), group("b", "Design", ["Figma", "HubSpot"])]);
    assert.deepEqual(added.skills, ["React", "Figma", "HubSpot"]);
  });
});

describe("printing groups", () => {
  it("skips groups with no skills and trims what is left", () => {
    assert.deepEqual(printableGroups([group("a", " Code ", [" React ", ""]), group("b", "Empty", [])]), [group("a", "Code", ["React"])]);
  });

  it("joins a line with commas, bullets or stars", () => {
    assert.equal(skillLine(["React", "Go"], "comma"), "React, Go");
    assert.equal(skillLine(["React", "Go"], "bullet"), "React • Go");
    assert.equal(skillLine(["React", "Go"], "star"), "React ★ Go");
  });
});
