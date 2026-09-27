// The onboarding form's resume -> profile mapping (app/lib/onboarding/profile.ts):
// a parsed resume fills BLANK fields only, skills arrive cleaned and deduped,
// links land on LinkedIn / GitHub / Portfolio, and education and work
// experience entries become the profile's. Also the seven checklist items,
// ticked live from the form, and their `/dashboard/onboarding#<id>` deep links.
//
// Every resume here is SYNTHETIC: made-up people, companies and skills, laid
// out like the real resumes the parser has to read.
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
  ANCHOR_FIELD,
  EMPTY_FORM_STATE,
  ITEM_FIELD,
  cleanSkills,
  educationFromResume,
  educationProblems,
  experienceFromResume,
  experienceProblems,
  formFromProfile,
  formReducer,
  formSatisfies,
  headlineWithoutName,
  itemFromHash,
  linksFromResume,
  liveOnboarding,
  prefillFromResume,
  skillsFromResume,
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

  it("lists Experience among what it filled when the resume has roles", () => {
    const { filled } = prefillFromResume(emptyForm(), resume({ experience: [{ id: "x1", role: "Designer", company: "Kite Labs", dates: "2020–2024", bullets: [] }] }));
    assert.deepEqual(filled, ["fullName", "headline", "location", "summary", "email", "phone", "skills", "education", "experience", "linkedin", "github", "portfolio"]);
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

  it("caps the list at 60", () => {
    assert.equal(cleanSkills(Array.from({ length: 70 }, (_, i) => `Skill ${i}`)).length, 60);
  });

  it("fills an empty list whole, and leaves a list with anything usable alone (no merge)", () => {
    assert.deepEqual(prefillFromResume(emptyForm(), resume()).patch.skills, ["Figma", "Design systems", "Prototyping"]);
    assert.equal("skills" in prefillFromResume({ ...emptyForm(), skills: ["Research"] }, resume()).patch, false);
    // Only blanks in it: still empty.
    assert.deepEqual(prefillFromResume({ ...emptyForm(), skills: ["  "] }, resume()).patch.skills, ["Figma", "Design systems", "Prototyping"]);
  });
});

// A designed resume's skills section: three columns of category headings, each over a comma
// list. Its text layer wraps lists mid-item, drops the space after some commas, ends some lists
// with a full stop and repeats a skill under two headings. Made-up content, the real layout.
const SKILLS_BLOCK = [
  "Programming Languages",
  "Go, Rust,Kotlin, Elixir, Stream",
  "processing",
  "Cloud Platforms",
  "Azure, Fly.io,Render",
  "Other",
  "Accessibility audits, Incident",
  "review, Patience.",
  "Frameworks & Libraries",
  "Phoenix, Django,Flask",
  "Payment Gateways",
  "Adyen, Paddle",
  "Soft Skills",
  "Mentoring, Pair",
  "programming, Negotiation.",
  "Databases",
  "CockroachDB, Redis",
  "Version Control",
  "Mercurial,Git",
  "Testing & tooling",
  "incident review, Load",
  "testing.",
].join("\n");

const BLOCK_SKILLS = [
  "Go",
  "Rust",
  "Kotlin",
  "Elixir",
  "Stream processing",
  "Azure",
  "Fly.io",
  "Render",
  "Accessibility audits",
  "Incident review",
  "Patience",
  "Phoenix",
  "Django",
  "Flask",
  "Adyen",
  "Paddle",
  "Mentoring",
  "Pair programming",
  "Negotiation",
  "CockroachDB",
  "Redis",
  "Mercurial",
  "Git",
  "Load testing",
];

describe("skills from a resume's categorised, multi-column skills section", () => {
  it("drops the category headings, joins wrapped items, splits on commas with or without a space and trims trailing stops", () => {
    assert.deepEqual(skillsFromResume([SKILLS_BLOCK]), { skills: BLOCK_SKILLS, leftOut: [] });
  });

  it("reads the same list after a parser split it on commas, leaving the line breaks in the pieces", () => {
    assert.deepEqual(skillsFromResume(SKILLS_BLOCK.split(",")).skills, BLOCK_SKILLS);
  });

  it("reads headings sent as entries of their own, and 'Label:' lists", () => {
    const skills = skillsFromResume(["Programming Languages", "Go", "Rust", "Soft Skills:", "Mentoring", "Databases: Redis,CockroachDB.", "Other", "Negotiation."]).skills;
    assert.deepEqual(skills, ["Go", "Rust", "Mentoring", "Redis", "CockroachDB", "Negotiation"]);
  });

  it("treats headings run together by the column layout as headings", () => {
    assert.deepEqual(skillsFromResume(["Frameworks Databases Other\nPhoenix, Redis, Patience"]).skills, ["Phoenix", "Redis", "Patience"]);
  });

  it("keeps skills that only look like category words, and the parts of CI/CD-style names", () => {
    const kept = ["Data", "Cloud", "DevOps", "Testing", "Git version control", "CI/CD", "C++", "C#", "Node.js", ".NET", "Design systems"];
    assert.deepEqual(skillsFromResume(kept).skills, kept);
  });

  it("drops repeats case-insensitively, keeping the first spelling", () => {
    assert.deepEqual(skillsFromResume(["Incident review", "incident  REVIEW", "Go", "go."]).skills, ["Incident review", "Go"]);
  });

  it("reads a list set one skill per line as one skill per line", () => {
    assert.deepEqual(skillsFromResume(["Research\nPrototyping\nUsability testing"]).skills, ["Research", "Prototyping", "Usability testing"]);
  });

  it("keeps the first 60 in resume order rather than dropping whole categories, and reports the rest", () => {
    const categories = ["Languages", "Frameworks", "Databases", "Tools", "Cloud Platforms", "Testing Tools", "Soft Skills"];
    const block = categories.map((heading, c) => `${heading}\n${Array.from({ length: 9 }, (_, i) => `Skill ${c}-${i}`).join(", ")}`).join("\n");
    const { skills, leftOut } = skillsFromResume([block]);
    assert.equal(skills.length, 60);
    assert.equal(skills[0], "Skill 0-0");
    assert.equal(skills[59], "Skill 6-5"); // every category has some in, the last one partly
    assert.deepEqual(leftOut, ["Skill 6-6", "Skill 6-7", "Skill 6-8"]);
  });

  it("fills the form with the cleaned list, and says what the 60 left out", () => {
    const many = Array.from({ length: 63 }, (_, i) => `Skill ${i}`);
    const { patch, skillsLeftOut } = prefillFromResume(emptyForm(), resume({ skills: [SKILLS_BLOCK] }));
    assert.deepEqual(patch.skills, BLOCK_SKILLS);
    assert.deepEqual(skillsLeftOut, []);
    assert.deepEqual(prefillFromResume(emptyForm(), resume({ skills: many })).skillsLeftOut, ["Skill 60", "Skill 61", "Skill 62"]);
    // Nothing filled, so nothing to report.
    assert.deepEqual(prefillFromResume({ ...emptyForm(), skills: ["Research"] }, resume({ skills: many })).skillsLeftOut, []);
  });
});

describe("headline — the name comes off a title that starts with it", () => {
  it("strips the parsed name, with any separator after it", () => {
    assert.equal(headlineWithoutName("Ada Obi Fullstack Developer", ["Ada Obi"]), "Fullstack Developer");
    assert.equal(headlineWithoutName("ADA  OBI | Product Designer", ["Ada Obi"]), "Product Designer");
    assert.equal(headlineWithoutName("Ada Obi, Staff Engineer", ["Ada Obi"]), "Staff Engineer");
  });

  it("leaves a title that doesn't start with the name, or only shares its first letters", () => {
    assert.equal(headlineWithoutName("Fullstack Developer", ["Ada Obi"]), "Fullstack Developer");
    assert.equal(headlineWithoutName("Adaeze Designer", ["Ada"]), "Adaeze Designer");
    assert.equal(headlineWithoutName("Designer", ["", null]), "Designer");
  });

  it("fills the headline with the title alone, and with nothing when the title was only the name", () => {
    assert.equal(prefillFromResume(emptyForm(), resume({ title: "Ada Obi Senior Product Designer" })).patch.headline, "Senior Product Designer");
    assert.equal("headline" in prefillFromResume(emptyForm(), resume({ title: "Ada Obi" })).patch, false);
    // The form's own name counts too, when the parser read none.
    assert.equal(prefillFromResume({ ...emptyForm(), fullName: "Ada Obi" }, resume({ name: "", title: "Ada Obi Designer" })).patch.headline, "Designer");
  });
});

describe("work experience", () => {
  const roles = [
    { id: "x1", role: "Product Designer - Team Lead", company: "Kite Labs", dates: "Mar 2022 – present", location: "Remote", bullets: ["• Led the checkout redesign", "  Cut drop-off\n   by 18%  ", "", "   "] },
    { id: "x2", role: "Designer", company: "", dates: "2019 – 2022", bullets: ["Shipped the design system"] },
    { id: "x3", role: "", company: "", dates: "2018", bullets: ["An orphaned bullet"] },
  ];

  it("maps role -> title, keeps company, dates, location and the bullets as written, and drops roles with neither a company nor a title", () => {
    assert.deepEqual(experienceFromResume({ experience: roles }), [
      { company: "Kite Labs", title: "Product Designer - Team Lead", dates: "Mar 2022 – present", location: "Remote", bullets: ["Led the checkout redesign", "Cut drop-off by 18%"] },
      { company: "", title: "Designer", dates: "2019 – 2022", location: "", bullets: ["Shipped the design system"] },
    ]);
  });

  it("keeps the backend's limits: 20 roles, 12 bullets, 500 characters a bullet, 160 a title", () => {
    const many = Array.from({ length: 23 }, (_, i) => ({ id: `r${i}`, role: "t".repeat(200), company: `Co ${i}`, dates: "", bullets: Array.from({ length: 15 }, () => "b".repeat(600)) }));
    const mapped = experienceFromResume({ experience: many });
    assert.equal(mapped.length, 20);
    assert.equal(mapped[0].title.length, 160);
    assert.equal(mapped[0].bullets.length, 12);
    assert.equal(mapped[0].bullets[0].length, 500);
  });

  it("fills a blank list only, keyed with the caller's stamp", () => {
    const { patch } = prefillFromResume(emptyForm(), resume({ experience: roles }), (i, list) => `stamp-${list}-${i}`);
    assert.equal(patch.experience.length, 2);
    assert.equal(patch.experience[0].id, "stamp-experience-0");
    assert.equal(patch.experience[0].title, "Product Designer - Team Lead");
    const typed = { ...emptyForm(), experience: [{ id: "a", company: "Mine", title: "", dates: "", location: "", bullets: [] }] };
    assert.equal("experience" in prefillFromResume(typed, resume({ experience: roles })).patch, false);
    // A row with nothing that counts in it is still blank.
    const empty = { ...emptyForm(), experience: [{ id: "a", company: " ", title: "", dates: "2020", location: "", bullets: [] }] };
    assert.equal(prefillFromResume(empty, resume({ experience: roles })).patch.experience.length, 2);
  });

  it("saves cleaned roles without editor ids, and flags a role with content but no company or title", () => {
    const rows = [
      { id: "ok", company: " Kite Labs ", title: "", dates: "", location: "", bullets: ["  Led it ", ""] },
      { id: "empty", company: "", title: "", dates: "", location: "", bullets: [""] },
      { id: "bad", company: "", title: " ", dates: "", location: "", bullets: ["Did things"] },
    ];
    assert.deepEqual(toProfilePatch({ experience: rows }), { experience: [{ company: "Kite Labs", title: "", dates: "", location: "", bullets: ["Led it"] }] });
    assert.deepEqual(experienceProblems(rows), ["bad"]);
  });

  it("reads the saved list defensively, from a profile that predates it too", () => {
    assert.deepEqual(emptyForm().experience, []);
    const form = formFromProfile({ experience: [{ company: "Kite Labs", title: "Designer", dates: "2020", location: "", bullets: ["Led it"] }] });
    assert.deepEqual(form.experience, [{ id: "saved-exp-0", company: "Kite Labs", title: "Designer", dates: "2020", location: "", bullets: ["Led it"] }]);
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

  it("mirrors the backend's rule for each checklist item", () => {
    const form = { ...emptyForm(), headline: "Designer", skills: ["a", "A", "b"], education: [{ id: "1", school: "Unilag", degree: "", dates: "", location: "", detail: "" }] };
    assert.equal(formSatisfies("headline", form), true);
    assert.equal(formSatisfies("skills", form), false); // "a" and "A" are one skill
    assert.equal(formSatisfies("education", form), true);
    // An id this build doesn't know (a newer server's, or v1's "resume") is never the form's to tick.
    assert.equal(formSatisfies("resume", form), false);
    // Work experience is optional: never an item, whatever the form holds.
    assert.equal(formSatisfies("experience", { ...form, experience: [{ id: "x", company: "Kite Labs", title: "", dates: "", location: "", bullets: [] }] }), false);
  });

  it("forgets the skills it reported once the save lands, or the notice is put away", () => {
    const state = { draft: { skills: ["Go"] }, prefilled: ["skills"], skillsLeftOut: ["Rust"] };
    assert.deepEqual(formReducer(state, { type: "saved", sent: { skills: ["Go"] } }).skillsLeftOut, []);
    assert.deepEqual(formReducer(state, { type: "dismiss-prefill" }).skillsLeftOut, []);
  });
});

/** The backend's `ONBOARDING_ITEMS` (remoteworldwidebackend src/types/onboarding.ts), in order: no resume, no phone, no experience. */
const ITEMS = ["fullName", "email", "summary", "education", "headline", "location", "skills"];
const LABELS = { fullName: "Full name", email: "Email", summary: "About you", education: "Education", headline: "Headline", location: "Location", skills: "At least 3 skills" };

/** The server's checklist with every item open unless named. */
const serverOnboarding = (done = []) => {
  const items = ITEMS.map((id) => ({ id, label: LABELS[id], done: done.includes(id) }));
  return { ready: items.every((item) => item.done), items, missing: items.filter((item) => !item.done).map((item) => item.id) };
};

/** A form that satisfies all seven items, with no work experience at all. */
const completeForm = () => ({
  ...emptyForm(),
  fullName: "Ada Obi",
  email: "ada@obi.dev",
  summary: "I design payment flows.",
  education: [{ id: "e", school: "Unilag", degree: "", dates: "", location: "", detail: "" }],
  headline: "Product Designer",
  location: "Lagos, Nigeria",
  skills: ["Figma", "Research", "Prototyping"],
  experience: [],
});

describe("the checklist, live from the form", () => {
  it("ticks an item the moment an unsaved edit satisfies it — no 'filled in, not saved' in between", () => {
    const form = { ...emptyForm(), headline: "Product Designer" };
    const live = liveOnboarding(serverOnboarding(), form, { headline: "Product Designer" });
    assert.equal(live.items.find((item) => item.id === "headline").done, true);
    assert.equal(live.items.length, 7);
    assert.deepEqual(live.items.map((item) => item.id), ITEMS); // the server's order and labels
    assert.equal(live.items[0].label, "Full name");
    assert.equal(live.missing.includes("headline"), false);
    assert.equal(live.ready, false);
  });

  it("is ready when the form holds all seven, saved or not", () => {
    const form = completeForm();
    const draft = { summary: form.summary, education: form.education, skills: form.skills };
    const live = liveOnboarding(serverOnboarding(["fullName", "email", "headline", "location"]), form, draft);
    assert.equal(live.ready, true);
    assert.deepEqual(live.missing, []);
  });

  it("never lets an empty work-experience list block ready", () => {
    const form = completeForm();
    assert.deepEqual(form.experience, []);
    assert.equal(liveOnboarding(serverOnboarding(ITEMS), form, {}).ready, true);
    assert.equal(liveOnboarding(serverOnboarding(ITEMS), form, { experience: [] }).ready, true);
    assert.equal(liveOnboarding(serverOnboarding(ITEMS), form, { experience: [{ id: "x", company: "", title: "", dates: "", location: "", bullets: [""] }] }).ready, true);
  });

  it("unticks a saved item the form has since emptied, and keeps the server's word on fields not edited", () => {
    const form = { ...completeForm(), headline: "" };
    const live = liveOnboarding(serverOnboarding(ITEMS), form, { headline: "" });
    assert.equal(live.ready, false);
    assert.deepEqual(live.missing, ["headline"]);
    // Not edited here: the server's answer stands, even where the form's copy disagrees.
    assert.equal(liveOnboarding(serverOnboarding(ITEMS), { ...form, location: "" }, { headline: "Designer" }).items.find((item) => item.id === "location").done, true);
  });

  it("keeps a newer server's unknown item as the server says", () => {
    const server = serverOnboarding(ITEMS);
    server.items.push({ id: "portfolioPieces", label: "Portfolio pieces", done: false });
    const live = liveOnboarding(server, completeForm(), { skills: ["Figma", "Research", "Prototyping"] });
    assert.equal(live.ready, false);
    assert.deepEqual(live.missing, ["portfolioPieces"]);
  });
});

describe("the checklist's items and their deep links", () => {
  it("has a form field for each of the seven items, and nothing else", () => {
    assert.deepEqual(Object.keys(ITEM_FIELD).sort(), [...ITEMS].sort());
    for (const id of ITEMS) assert.equal(ITEM_FIELD[id], id);
    assert.equal("resume" in ITEM_FIELD, false);
    assert.equal("experience" in ITEM_FIELD, false);
  });

  it("reads every item's id from a hash, with or without the #", () => {
    for (const id of ITEMS) {
      assert.equal(itemFromHash(`#${id}`), id);
      assert.equal(itemFromHash(id), id);
    }
  });

  it("opens the optional work-experience section from #experience, though it is not an item", () => {
    assert.equal(itemFromHash("#experience"), "experience");
    assert.equal(itemFromHash("#Experience"), "experience");
    assert.equal(ANCHOR_FIELD.experience, "experience");
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
