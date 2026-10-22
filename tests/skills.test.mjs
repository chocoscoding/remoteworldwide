// Skills as entries (app/lib/resume/skills.ts): every entry is a skill, or a
// name over sub skills typed as text with commas. The flat list is what the AI
// tools and the ATS check read: sub skills over a name, a plain skill's name.
// The entries follow when something that only knows the flat list (Tailor, Add
// missing keywords, a resume saved before entries) changes it.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// The module imports types only, so no resolve hook is needed.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const {
  addSkillNear,
  addSkills,
  entriesOf,
  flattenGroups,
  hasSkill,
  parseSubSkills,
  printableGroups,
  printableSkills,
  reconcileGroups,
  removeSkills,
  skillLine,
  subSkillText,
  withEntries,
} = await import("../app/lib/resume/skills.ts");

const base = { name: "", skills: ["React", "Figma"] };
const entry = (id, title, skills = [], extra = {}) => ({ id, title, skills, ...extra });

describe("entries and the flat list", () => {
  it("reads a resume saved before entries as one entry per skill", () => {
    assert.deepEqual(entriesOf(base), [entry("skl-react", "React"), entry("skl-figma", "Figma")]);
  });

  it("lists sub skills over a name, a plain skill's name, each once whatever its case", () => {
    const entries = [entry("a", "Soft Skills", ["Teamwork", "Empathy"]), entry("b", "React"), entry("c", "Frontend", ["react", " ", "Vue"])];
    assert.deepEqual(flattenGroups(entries), ["Teamwork", "Empathy", "React", "Vue"]);
  });

  it("leaves hidden and nameless entries out of the flat list", () => {
    assert.deepEqual(flattenGroups([entry("a", "Go", [], { hidden: true }), entry("b", ""), entry("c", "Rust")]), ["Rust"]);
  });

  it("writes both together", () => {
    const next = withEntries(base, [entry("a", "Design", ["Figma", "Sketch"])]);
    assert.deepEqual(next.skills, ["Figma", "Sketch"]);
    assert.deepEqual(next.skillGroups, [entry("a", "Design", ["Figma", "Sketch"])]);
  });

  it("reads sub skills from text with commas, and writes them back the same way", () => {
    assert.deepEqual(parseSubSkills("Teamwork, Empathy,, Time Management, "), ["Teamwork", "Empathy", "Time Management"]);
    assert.equal(subSkillText(["Teamwork", "Empathy"]), "Teamwork, Empathy");
  });
});

describe("keeping the entries in step with the flat list", () => {
  it("turns a resume saved before entries into entries", () => {
    const fixed = reconcileGroups(base);
    assert.deepEqual(fixed.skillGroups, [entry("skl-react", "React"), entry("skl-figma", "Figma")]);
    assert.deepEqual(fixed.skills, ["React", "Figma"]);
  });

  it("drops a skill the list lost, from its entry or with it, and puts a new one with its kind", () => {
    const entries = withEntries(base, [entry("a", "Code", ["React", "Vue"]), entry("b", "Figma"), entry("c", "Old", ["Gone"])]);
    const tailored = reconcileGroups({ ...entries, skills: ["React", "TypeScript"] });
    // Every skill left sits in a named group: the new one goes under "Other", never on a line of its own.
    assert.deepEqual(tailored.skillGroups, [entry("a", "Code", ["React"]), entry("skl-other", "Other", ["TypeScript"])]);
    assert.deepEqual(tailored.skills, ["React", "TypeScript"]);
    const plain = reconcileGroups({ ...withEntries(base, [entry("a", "Code", ["React"]), entry("b", "Figma")]), skills: ["React", "Figma", "Go"] });
    assert.deepEqual(plain.skillGroups, [entry("a", "Code", ["React"]), entry("b", "Figma"), entry("skl-go", "Go")]);
  });

  it("puts a skill a tool added to the flat list into Others (2026-10-22: \"Rapid prototyping\" sat on a line of its own)", () => {
    const groups = [entry("a", "Programming Languages", ["TypeScript", "Python"]), entry("b", "Others", ["Jest", "n8n"]), entry("c", "Database", ["MongoDB"])];
    const content = { skills: flattenGroups(groups), skillGroups: groups };
    const next = reconcileGroups({ ...content, skills: [...content.skills, "Rapid prototyping"] });
    assert.deepEqual(
      next.skillGroups.map((group) => [group.title, group.skills]),
      [
        ["Programming Languages", ["TypeScript", "Python"]],
        ["Others", ["Jest", "n8n", "Rapid prototyping"]],
        ["Database", ["MongoDB"]],
      ],
    );
    assert.deepEqual(next.skills, flattenGroups(next.skillGroups));
  });

  it("keeps hidden entries and the one being added as they are", () => {
    const entries = withEntries(base, [entry("a", "React"), entry("b", "Go", [], { hidden: true }), entry("c", "")]);
    assert.equal(reconcileGroups(entries), entries);
  });

  it("returns the same content when nothing was out of step", () => {
    const entries = withEntries(base, [entry("a", "Code", ["React"]), entry("b", "Figma")]);
    assert.equal(reconcileGroups(entries), entries);
  });
});

describe("adding a keyword to Skills", () => {
  it("adds it as an entry at the end, once whatever its case", () => {
    const entries = withEntries(base, [entry("a", "Code", ["React"]), entry("b", "Figma")]);
    const added = addSkills(entries, ["HubSpot", "react"]);
    assert.deepEqual(added.skillGroups, [entry("a", "Code", ["React"]), entry("b", "Figma"), entry("skl-hubspot", "HubSpot")]);
    assert.deepEqual(added.skills, ["React", "Figma", "HubSpot"]);
    assert.ok(hasSkill(added, "hubspot"));
    assert.equal(addSkills(entries, ["figma"]), entries);
  });

  it("adds a skill to the plain list, never on a line of its own below an entry with sub skills", () => {
    const groups = [entry("a", "Figma"), entry("b", "Product design"), entry("c", "English", ["native-level"])];
    const content = { skills: flattenGroups(groups), skillGroups: groups };
    const added = addSkills(content, ["Product marketing"]);
    assert.deepEqual(
      added.skillGroups.map((group) => group.title),
      ["Figma", "Product design", "Product marketing", "English"],
    );
    assert.deepEqual(added.skills, flattenGroups(added.skillGroups));
  });
  it("adds a skill into the Other group when every skill sits in a named group", () => {
    const groups = [entry("a", "Frameworks", ["React", "Express"]), entry("b", "Others", ["Tailwind CSS"])];
    const added = addSkills({ skills: flattenGroups(groups), skillGroups: groups }, ["Sanity"]);
    assert.deepEqual(added.skillGroups.map((group) => [group.title, group.skills]), [["Frameworks", ["React", "Express"]], ["Others", ["Tailwind CSS", "Sanity"]]]);
    const plain = [entry("a", "Frameworks", ["React"])];
    const made = addSkills({ skills: flattenGroups(plain), skillGroups: plain }, ["Sanity"]);
    assert.deepEqual(made.skillGroups.map((group) => [group.title, group.skills]), [["Frameworks", ["React"]], ["Other", ["Sanity"]]]);
    assert.deepEqual(made.skills, flattenGroups(made.skillGroups));
  });

  it("adds a skill beside the ones it goes with (2026-10-21: Java went in after \"Rapid prototyping\")", () => {
    const groups = [entry("a", "Programming Languages", ["TypeScript", "Python", "SQL"]), entry("b", "Cloud Platforms", ["AWS", "GCP"]), entry("c", "Rapid prototyping")];
    const content = { skills: flattenGroups(groups), skillGroups: groups };
    const java = addSkillNear(content, "Java", ["Python", "sql"]);
    assert.deepEqual(java.skillGroups[0].skills, ["TypeScript", "Python", "SQL", "Java"]);
    assert.deepEqual(java.skills, flattenGroups(java.skillGroups));
    assert.deepEqual(addSkillNear(content, "Azure", ["AWS", "GCP"]).skillGroups[1].skills, ["AWS", "GCP", "Azure"]);
    // Nothing it goes with: as any skill. Already there: the same content.
    assert.deepEqual(addSkillNear(content, "Facebook API", ["Instagram API"]), addSkills(content, ["Facebook API"]));
    assert.equal(addSkillNear(content, "python", ["SQL"]), content);
  });
});

describe("printing", () => {
  it("prints a name over its sub skills, and runs of plain skills as one list without a name", () => {
    const entries = [
      entry("a", "React"),
      entry("b", " Go "),
      entry("c", "Soft Skills", [" Teamwork ", ""]),
      entry("d", "Hidden", [], { hidden: true }),
      entry("e", ""),
      entry("f", "Figma"),
    ];
    assert.deepEqual(printableGroups(entries), [
      entry("plain:a", "", ["React", "Go"]),
      entry("c", "Soft Skills", ["Teamwork"]),
      entry("plain:f", "", ["Figma"]),
    ]);
  });

  it("prints a resume saved before entries as one list", () => {
    assert.deepEqual(printableSkills(base), [entry("plain:skl-react", "", ["React", "Figma"])]);
  });

  it("joins a line with commas, bullets or stars", () => {
    assert.equal(skillLine(["React", "Go"], "comma"), "React, Go");
    assert.equal(skillLine(["React", "Go"], "bullet"), "React • Go");
    assert.equal(skillLine(["React", "Go"], "star"), "React ★ Go");
  });
});

describe("removeSkills", () => {
  it("takes skills out of the list and the entries, whatever their case", () => {
    const content = withEntries({ skills: [], skillGroups: [] }, [
      { id: "a", title: "Tools", skills: ["Okta", "Jamf"] },
      { id: "b", title: "MDM rollout", skills: [] },
    ]);
    const out = removeSkills(content, ["okta", "mdm rollout"]);
    assert.deepEqual(out.skills, ["Jamf"]);
    assert.deepEqual(
      out.skillGroups.map((group) => [group.title, group.skills]),
      [["Tools", ["Jamf"]]],
    );
    assert.equal(removeSkills(content, ["Go"]), content);
  });
});
