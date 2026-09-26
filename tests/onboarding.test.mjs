// The onboarding form's resume -> profile mapping (app/lib/onboarding/profile.ts):
// a parsed resume fills BLANK fields only, skills arrive deduped, links land on
// LinkedIn / GitHub / Portfolio, and education entries become the profile's.
// Also the seven checklist items and their `/onboarding#<id>` deep links.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as print.test.mjs: Node resolves neither the `@/` alias nor an
// extensionless `./x`, so the hook maps them the way tsconfig does. The module
// under test imports types only, which is part of what this checks.

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

const {
  EMPTY_FORM_STATE,
  ITEM_FIELD,
  cleanSkills,
  educationFromResume,
  educationProblems,
  formFromProfile,
  formReducer,
  formSatisfies,
  itemFromHash,
  linksFromResume,
  prefillFromResume,
  toProfilePatch,
} = await import("../app/lib/onboarding/profile.ts");

/** A parsed resume, as `GET /api/ai/resume/:id` answers with `content`. */
const resume = (overrides = {}) => ({
  name: "Ada Obi",
  title: "Senior Product Designer",
  location: "Lagos, Nigeria",
  email: "ada@obi.dev",
  phone: "+234 801 234 5678",
  portfolio: "",
  links: [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/adaobi" },
    { label: "GitHub", url: "https://github.com/adaobi" },
    { label: "Portfolio", url: "https://adaobi.design" },
  ],
  summary: "I design payment flows.\n\nTen years in fintech.",
  experience: [],
  education: [
    { id: "e1", school: "University of Lagos", degree: "BSc Computer Science", dates: "2010–2014", location: "Lagos", detail: "First class" },
    { id: "e2", school: "", degree: "Short course", dates: "2016" },
  ],
  projects: [],
  certifications: [],
  skills: ["Figma", "figma", "  Design   systems ", "Prototyping", "x".repeat(61), ""],
  ...overrides,
});

const emptyForm = () => formFromProfile({});

describe("prefillFromResume — blank fields only", () => {
  it("fills every blank field it has a value for, mapped to the profile's names", () => {
    const { patch, filled } = prefillFromResume(emptyForm(), resume());
    assert.equal(patch.fullName, "Ada Obi");
    assert.equal(patch.headline, "Senior Product Designer"); // title -> headline
    assert.equal(patch.location, "Lagos, Nigeria");
    assert.equal(patch.summary, "I design payment flows.\n\nTen years in fintech."); // summary -> About, paragraphs kept
    assert.equal(patch.email, "ada@obi.dev");
    assert.equal(patch.phone, "+234 801 234 5678");
    assert.deepEqual(filled, ["fullName", "headline", "location", "summary", "email", "phone", "skills", "education", "linkedin", "github", "portfolio"]);
  });

  it("never touches a field that already has something in it", () => {
    const form = {
      ...emptyForm(),
      fullName: "Ada O.",
      headline: "Designer",
      summary: "Mine.",
      email: "me@example.com",
      linkedin: "linkedin.com/in/mine",
      skills: ["Research"],
      education: [{ id: "saved-0", school: "My school", degree: "", dates: "", location: "", detail: "" }],
    };
    const { patch, filled } = prefillFromResume(form, resume());
    for (const kept of ["fullName", "headline", "summary", "email", "linkedin", "skills", "education"]) {
      assert.equal(kept in patch, false, `${kept} was overwritten`);
    }
    assert.deepEqual(filled, ["location", "phone", "github", "portfolio"]);
  });

  it("treats whitespace as blank, and leaves a field blank when the resume has nothing for it", () => {
    const { patch } = prefillFromResume({ ...emptyForm(), headline: "   " }, resume({ phone: "", title: "  " }));
    assert.equal("headline" in patch, false);
    assert.equal("phone" in patch, false);
  });

  it("clamps to the backend's ceilings so a prefilled save is never refused as too long", () => {
    const { patch } = prefillFromResume(emptyForm(), resume({ summary: "a".repeat(2500), title: "t".repeat(200) }));
    assert.equal(patch.summary.length, 2000);
    assert.equal(patch.headline.length, 160);
  });
});

describe("skills", () => {
  it("dedupes case-insensitively, collapses spaces, drops blanks and sentence-length entries", () => {
    assert.deepEqual(cleanSkills(resume().skills), ["Figma", "Design systems", "Prototyping"]);
  });

  it("caps the list at 40", () => {
    assert.equal(cleanSkills(Array.from({ length: 50 }, (_, i) => `Skill ${i}`)).length, 40);
  });

  it("fills an empty list whole, and leaves a list with anything usable alone (no merge)", () => {
    assert.deepEqual(prefillFromResume(emptyForm(), resume()).patch.skills, ["Figma", "Design systems", "Prototyping"]);
    assert.equal("skills" in prefillFromResume({ ...emptyForm(), skills: ["Research"] }, resume()).patch, false);
    // Only blanks in it: still empty.
    assert.deepEqual(prefillFromResume({ ...emptyForm(), skills: ["  "] }, resume()).patch.skills, ["Figma", "Design systems", "Prototyping"]);
  });
});

describe("links -> linkedin / github / portfolio", () => {
  it("routes each link by its address first, then its label", () => {
    assert.deepEqual(linksFromResume(resume()), {
      linkedin: "https://www.linkedin.com/in/adaobi",
      github: "https://github.com/adaobi",
      portfolio: "https://adaobi.design",
    });
    assert.deepEqual(
      linksFromResume({ portfolio: "", links: [{ label: "My work", url: "github.com/ada" }, { label: "Website", url: "ada.github.io" }] }),
      { linkedin: "", github: "github.com/ada", portfolio: "ada.github.io" },
    );
  });

  it("prefers the parser's own portfolio, takes the first of each kind, and skips links the profile has no field for", () => {
    const links = linksFromResume({
      portfolio: "https://ada.dev",
      links: [
        { label: "Twitter", url: "https://x.com/ada" },
        { label: "Portfolio", url: "https://other.dev" },
        { label: "LinkedIn", url: "https://linkedin.com/in/first" },
        { label: "LinkedIn", url: "https://linkedin.com/in/second" },
      ],
    });
    assert.deepEqual(links, { linkedin: "https://linkedin.com/in/first", github: "", portfolio: "https://ada.dev" });
  });
});

describe("education", () => {
  it("maps entries to the profile's shape and drops the ones with no school", () => {
    assert.deepEqual(educationFromResume(resume()), [
      { school: "University of Lagos", degree: "BSc Computer Science", dates: "2010–2014", location: "Lagos", detail: "First class" },
    ]);
  });

  it("defaults the optional fields to empty strings and keeps at most 10", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, school: `School ${i}`, degree: "", dates: "" }));
    const mapped = educationFromResume({ education: many });
    assert.equal(mapped.length, 10);
    assert.deepEqual(mapped[0], { school: "School 0", degree: "", dates: "", location: "", detail: "" });
  });

  it("fills only when no row names a school, keying the new rows with the caller's stamp", () => {
    const { patch } = prefillFromResume(emptyForm(), resume(), (i) => `stamp-${i}`);
    assert.equal(patch.education.length, 1);
    assert.equal(patch.education[0].id, "stamp-0");
    const halfFilled = { ...emptyForm(), education: [{ id: "a", school: "", degree: "MSc", dates: "", location: "", detail: "" }] };
    assert.equal(prefillFromResume(halfFilled, resume()).patch.education.length, 1);
  });
});

describe("saving", () => {
  it("sends only what changed, cleaned, with education stripped of editor ids", () => {
    const patch = toProfilePatch({
      headline: "  Designer  ",
      skills: ["Figma", "figma", "UX"],
      education: [
        { id: "x", school: " Unilag ", degree: "BSc", dates: "", location: "", detail: "" },
        { id: "y", school: "", degree: "", dates: "", location: "", detail: "" },
      ],
    });
    assert.deepEqual(patch, {
      headline: "Designer",
      skills: ["Figma", "UX"],
      education: [{ school: "Unilag", degree: "BSc", dates: "", location: "", detail: "" }],
    });
    assert.equal("fullName" in patch, false);
  });

  it("flags a half-filled education row, which the backend would refuse", () => {
    const rows = [
      { id: "ok", school: "Unilag", degree: "", dates: "", location: "", detail: "" },
      { id: "empty", school: "", degree: "", dates: "", location: "", detail: "" },
      { id: "bad", school: " ", degree: "MSc", dates: "", location: "", detail: "" },
    ];
    assert.deepEqual(educationProblems(rows), ["bad"]);
  });
});

describe("the form's state", () => {
  it("prefills against the edits made while the resume was being read", () => {
    const base = emptyForm();
    const typed = formReducer(EMPTY_FORM_STATE, { type: "edit", patch: { headline: "Typed while parsing" } });
    const next = formReducer(typed, { type: "prefill", base, content: resume(), stamp: "s" });
    assert.equal(next.draft.headline, "Typed while parsing");
    assert.equal(next.draft.location, "Lagos, Nigeria");
    assert.equal(next.prefilled.includes("headline"), false);
  });

  it("clears only what was saved and not edited again in flight", () => {
    const state = { draft: { headline: "B", location: "Lagos" }, prefilled: ["location"] };
    const next = formReducer(state, { type: "saved", sent: { headline: "A", location: "Lagos" } });
    assert.deepEqual(next.draft, { headline: "B" });
    assert.equal(next.prefilled, null);
  });

  it("mirrors the backend's rule for the checklist's 'save to count' state", () => {
    const form = { ...emptyForm(), headline: "Designer", skills: ["a", "A", "b"], education: [{ id: "1", school: "Unilag", degree: "", dates: "", location: "", detail: "" }] };
    assert.equal(formSatisfies("headline", form), true);
    assert.equal(formSatisfies("skills", form), false); // "a" and "A" are one skill
    assert.equal(formSatisfies("education", form), true);
    // An id this build doesn't know (a newer server's, or v1's "resume") is never the form's to tick.
    assert.equal(formSatisfies("resume", form), false);
  });
});

/** The backend's `ONBOARDING_ITEMS` (remoteworldwidebackend src/types/onboarding.ts), in order: no resume, no phone. */
const ITEMS = ["fullName", "email", "summary", "education", "headline", "location", "skills"];

describe("the checklist's items and their deep links", () => {
  it("has a form field for each of the seven items, and nothing else", () => {
    assert.deepEqual(Object.keys(ITEM_FIELD).sort(), [...ITEMS].sort());
    for (const id of ITEMS) assert.equal(ITEM_FIELD[id], id);
    assert.equal("resume" in ITEM_FIELD, false);
  });

  it("reads every item's id from a hash, with or without the #", () => {
    for (const id of ITEMS) {
      assert.equal(itemFromHash(`#${id}`), id);
      assert.equal(itemFromHash(id), id);
    }
  });

  it("forgives case, stray spaces and an escaped hash", () => {
    assert.equal(itemFromHash("#fullname"), "fullName");
    assert.equal(itemFromHash("#SKILLS"), "skills");
    assert.equal(itemFromHash("# education "), "education");
    assert.equal(itemFromHash("#%65ducation"), "education");
  });

  it("names no item for anything else, so the page opens at the top", () => {
    for (const hash of ["", "#", null, undefined, "#resume", "#phone", "#onb-profile", "#onb-education", "#toString", "#__proto__", "#%E0%A4%A", "#education,skills"]) {
      assert.equal(itemFromHash(hash), null, String(hash));
    }
  });
});
