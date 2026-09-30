// The onboarding profile form, as pure functions: what a parsed resume fills
// in, what a save sends, and what the checklist can already tell before the
// save lands.
//
// Pure and type-only in its imports on purpose — `tests/onboarding.test.mjs`
// runs it under plain `node --test`, and the moment this grows a runtime
// import Node cannot load, that file stops loading.
//
// The one rule the whole mapping keeps: a resume only ever fills a BLANK
// field. What someone typed, or already saved, is theirs; the resume is a
// starting point for an empty profile, never a second opinion on a full one.
// Lists count as blank when they hold nothing usable — no skills at all, no
// school with a name, no role with a company or title — and are then filled
// whole rather than merged, so a curated skills list never grows thirty parser
// guesses on the end of it.

import type { ResumeContent, ResumeLink } from "@/app/lib/dashboard/types";
import type { Onboarding, OnboardingItem, OnboardingItemId, ProfileEducation, ProfileExperience, ProfileSettings } from "@/app/lib/settings/types";

/**
 * The backend validator's ceilings (remoteworldwidebackend
 * `src/validators/settings.validator.ts` and the education rule in the
 * onboarding contract). A prefilled value is clamped to them so saving what
 * the parser read can never be refused as too long.
 */
export const PROFILE_LIMITS = {
  fullName: 120,
  headline: 160,
  email: 254,
  phone: 40,
  location: 120,
  summary: 2000,
  link: 300,
  skill: 60,
  skills: 60,
} as const;

export const EDUCATION_LIMITS = { entries: 10, school: 160, degree: 160, dates: 60, location: 120, detail: 500 } as const;

/** The backend's `profile.experience` rule (TASK 4 contract): ≤20 roles, each ≤12 bullets of ≤500. */
export const EXPERIENCE_LIMITS = { entries: 20, company: 160, title: 160, dates: 60, location: 120, bullets: 12, bullet: 500 } as const;

/** The backend's `ELIGIBILITY_MIN_SKILLS`: "enough skills" means one thing across the product. */
export const MIN_SKILLS = 3;

/** An education row in the editor: the saved shape plus a key of the editor's own (the server keeps none). */
export interface EducationRow extends ProfileEducation {
  id: string;
}

/** A work-experience row in the editor, keyed like `EducationRow`. */
export interface ExperienceRow extends ProfileExperience {
  id: string;
}

/**
 * Everything the onboarding form edits. Phone, the three links and work experience are optional;
 * the rest are checklist items.
 */
export interface ProfileForm {
  fullName: string;
  headline: string;
  location: string;
  summary: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  skills: string[];
  education: EducationRow[];
  experience: ExperienceRow[];
}

export type ProfileField = keyof ProfileForm;

/** How a field is named where the form says what the resume filled in. */
export const FIELD_LABELS: Record<ProfileField, string> = {
  fullName: "Name",
  headline: "Headline",
  location: "Location",
  summary: "About",
  email: "Email",
  phone: "Phone",
  linkedin: "LinkedIn",
  github: "GitHub",
  portfolio: "Portfolio",
  skills: "Skills",
  education: "Education",
  experience: "Experience",
};

/**
 * The field each checklist item is fixed in — the same name, since the checklist and the form both
 * follow the profile. A Record, not a list, so an item added to `OnboardingItemId` fails to compile
 * here until it has a field. Every item is one of this form's: a resume is not an item (a resume
 * can be built from the profile; the page only offers to start from one), and neither is work
 * experience (owner, 2026-09-27: "experience not required, can be skipped").
 */
export const ITEM_FIELD: Record<OnboardingItemId, ProfileField> = {
  fullName: "fullName",
  email: "email",
  summary: "summary",
  education: "education",
  headline: "headline",
  location: "location",
  skills: "skills",
};

/** Where a `#hash` can open the form: every checklist item, plus work experience, which is on the form but never an item. */
export type FormAnchor = OnboardingItemId | "experience";

export const ANCHOR_FIELD: Record<FormAnchor, ProfileField> = { ...ITEM_FIELD, experience: "experience" };

/**
 * The place a URL hash names, or null: `/dashboard/onboarding#education` opens the form at
 * Education. The extension's "Finish your profile" links and chat's "this is missing" buttons are
 * built on the item ids (`OnboardingItemId`), so this is their contract with the page;
 * `#experience` opens the optional work-experience section. Forgiving about case and a missing `#`
 * (a hand-typed `#fullname` still lands); anything else — `#onb-profile`, junk, a malformed
 * escape — names nothing, and the page opens at the top as usual.
 */
export function itemFromHash(hash: string | null | undefined): FormAnchor | null {
  let wanted: string;
  try {
    wanted = decodeURIComponent((hash ?? "").replace(/^#/, "")).trim().toLowerCase();
  } catch {
    return null;
  }
  if (!wanted) return null;
  return (Object.keys(ANCHOR_FIELD) as FormAnchor[]).find((id) => id.toLowerCase() === wanted) ?? null;
}

const blank = (value: string | null | undefined): boolean => !value || value.trim().length === 0;

/** One line: inner runs of whitespace (a PDF's line wraps) collapse to one space. */
const line = (value: unknown, max: number): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max).trim() : "");

/** Prose keeps its paragraphs; only the ends are trimmed. */
const prose = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max).trim() : "");

/** Rows that name a school — the only ones the backend accepts, and the only ones the checklist counts. */
export const schoolCount = (rows: readonly Pick<ProfileEducation, "school">[]): number => rows.filter((row) => !blank(row.school)).length;

/** Skills as the backend keeps them: trimmed, one space inside, none over 60 characters, no case-insensitive repeats, at most 60. */
export function cleanSkills(skills: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const skill = line(raw, Number.MAX_SAFE_INTEGER);
    // Dropped, not cut: a "skill" past 60 characters is a sentence the parser
    // misfiled, and its first 60 characters would be a worse skill than none.
    if (!skill || skill.length > PROFILE_LIMITS.skill || seen.has(skill.toLowerCase())) continue;
    seen.add(skill.toLowerCase());
    out.push(skill);
    if (out.length === PROFILE_LIMITS.skills) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// A resume's skills section, cleaned up
// ---------------------------------------------------------------------------
//
// Defence in depth behind the parser. A designed resume sets skills out in
// columns of category headings, each over a comma list — and its text layer
// wraps those lists mid-item ("Stream\nprocessing"), drops the space after a
// comma ("Go,Rust") and ends a list with a full stop. Whatever of that reaches
// the form is undone here, before a single skill is offered.

/** A word that qualifies a heading's noun ("Programming" Languages, "Soft" Skills, "Version" Control). */
const HEADING_QUALIFIER =
  "(?:programming|coding|scripting|query|markup|spoken|foreign|technical|tech|soft|hard|core|key|additional|interpersonal|professional|transferable|cloud|web|mobile|front[- ]?end|back[- ]?end|devops|data|payments?|support|developer|design|testing|version|productivity|collaboration|software|ai|ml)";
/** The nouns a skills category heading ends on. Never qualifiers too, so a match cannot backtrack exponentially. */
const HEADING_NOUN =
  "(?:languages?|skills?|frameworks?|librar(?:y|ies)|platforms?|tools?|tooling|technolog(?:y|ies)|databases?|gateways?|control|others?|methodolog(?:y|ies)|competenc(?:y|ies)|stack)";
const HEADING_JOIN = "\\s*(?:&|and|\\/|\\+)?\\s*";
const HEADING_WORD = `(?:${HEADING_QUALIFIER}${HEADING_JOIN})*${HEADING_NOUN}`;
/**
 * A skills category heading, alone on its line: "Programming Languages", "Soft Skills", "Testing &
 * tooling", "Others", or several run together by a column layout ("Frameworks Databases Others").
 * A label over a list, never a skill. Deliberately narrow: "Data", "Cloud", "DevOps" or "Testing"
 * on their own are skills, and "Git version control" is one too.
 */
const SKILL_HEADING = new RegExp(`^${HEADING_WORD}(?:${HEADING_JOIN}${HEADING_WORD})*\\s*:?$`, "i");
const isSkillHeading = (text: string): boolean => text.length <= 80 && SKILL_HEADING.test(text.trim());

/** "Languages: Go, Rust" — a category label before the list on its own line. */
const SKILL_LABEL = /^[A-Za-z][A-Za-z0-9 +#.&/-]{0,39}:\s*/;
/** Between two skills. Not "/": CI/CD, TCP/IP and React/Next are one skill each. */
const SKILL_SEPARATOR = /[,;|•·▪●]/;
/** Words that end a list without being a skill. */
const NOT_A_SKILL = /^(?:etc|and more|and others|more|misc(?:ellaneous)?)$/i;

export interface ResumeSkills {
  /** At most `PROFILE_LIMITS.skills`, in the resume's order. */
  skills: string[];
  /** Real skills past that cap, in order: what the form says it left out. */
  leftOut: string[];
}

/**
 * A parsed resume's skills as the profile should take them:
 *
 * - category headings out, whether they came as an entry, a line, or a "Label:" before a list;
 * - a list wrapped over several lines joined back ("Stream\nprocessing" is "Stream processing"),
 *   except where a line ends in a full stop (a list's end, so the next line starts another);
 * - split on commas and semicolons, with or without a space after them;
 * - leading bullets and trailing punctuation trimmed ("Patience." is "Patience");
 * - repeats dropped case-insensitively, the first spelling kept;
 * - the first 40 kept in resume order rather than whole categories dropped, and the rest reported.
 *
 * Several entries, or separators inside one, mean the resume listed its skills inline, so a line
 * break inside an entry is a wrap. A single entry with neither is a list set one skill per line.
 */
export function skillsFromResume(raw: readonly unknown[]): ResumeSkills {
  const entries = raw.filter((value): value is string => typeof value === "string");
  const inline = entries.length > 1 || entries.some((entry) => SKILL_SEPARATOR.test(entry));
  const pieces: string[] = [];

  for (const entry of entries) {
    let run = "";
    const flush = () => {
      if (run) pieces.push(...run.split(SKILL_SEPARATOR));
      run = "";
    };
    for (const rawLine of entry.split(/\r?\n/)) {
      let text = rawLine.trim();
      if (!text) continue;
      if (isSkillHeading(text)) {
        flush();
        continue;
      }
      const label = SKILL_LABEL.exec(text);
      if (label && text.length > label[0].length) {
        flush();
        text = text.slice(label[0].length);
      }
      // A full stop ends a list; one skill per line ends every item.
      if (!inline || /\.$/.test(run)) flush();
      run = run ? `${run} ${text}` : text;
    }
    flush();
  }

  const seen = new Set<string>();
  const all: string[] = [];
  for (const piece of pieces) {
    const skill = piece
      .replace(/\s+/g, " ")
      .replace(/^[\s•●◦▪■*·\-–—]+/, "")
      .replace(/[\s.,;:!]+$/, "")
      .replace(/^and\s+/i, "")
      .trim();
    // Dropped, not cut, past 60 characters: that is a sentence the parser misfiled.
    if (!skill || skill.length > PROFILE_LIMITS.skill || !/[\p{L}\p{N}]/u.test(skill) || isSkillHeading(skill) || NOT_A_SKILL.test(skill)) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(skill);
  }
  return { skills: all.slice(0, PROFILE_LIMITS.skills), leftOut: all.slice(PROFILE_LIMITS.skills) };
}

/** One education entry, trimmed and clamped. Null when it names no school: the backend refuses those. */
export function cleanEducation(entry: Partial<ProfileEducation> | null | undefined): ProfileEducation | null {
  const school = line(entry?.school, EDUCATION_LIMITS.school);
  if (!school) return null;
  return {
    school,
    degree: line(entry?.degree, EDUCATION_LIMITS.degree),
    dates: line(entry?.dates, EDUCATION_LIMITS.dates),
    location: line(entry?.location, EDUCATION_LIMITS.location),
    detail: prose(entry?.detail, EDUCATION_LIMITS.detail),
  };
}

/** A pasted or parsed bullet's own marker ("• Shipped…"): the list draws its own. The space after it is required, so "-5% churn" keeps its minus. */
const BULLET_MARKER = /^\s*[•●◦▪■*\-–—]\s+/;

/** A role's bullets as the backend keeps them: one line each, markers off, empty ones dropped, clamped, at most 12. */
export function cleanBullets(bullets: readonly unknown[] | null | undefined): string[] {
  return (Array.isArray(bullets) ? bullets : [])
    .map((bullet) => (typeof bullet === "string" ? line(bullet.replace(BULLET_MARKER, ""), EXPERIENCE_LIMITS.bullet) : ""))
    .filter((bullet) => bullet.length > 0)
    .slice(0, EXPERIENCE_LIMITS.bullets);
}

/** One role, trimmed and clamped. Null when it names neither a company nor a title: the backend refuses those. */
export function cleanExperience(entry: Partial<ProfileExperience> | null | undefined): ProfileExperience | null {
  const company = line(entry?.company, EXPERIENCE_LIMITS.company);
  const title = line(entry?.title, EXPERIENCE_LIMITS.title);
  if (!company && !title) return null;
  return {
    company,
    title,
    dates: line(entry?.dates, EXPERIENCE_LIMITS.dates),
    location: line(entry?.location, EXPERIENCE_LIMITS.location),
    bullets: cleanBullets(entry?.bullets),
  };
}

/** Roles that name a company or a title — the only ones the backend keeps. */
export const roleCount = (rows: readonly Pick<ProfileExperience, "company" | "title">[]): number =>
  rows.filter((row) => !blank(row.company) || !blank(row.title)).length;

/** The saved profile as the form starts from it. Defensive: a cached profile may predate `education` or `experience`. */
export function formFromProfile(profile: Partial<ProfileSettings> | null | undefined): ProfileForm {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const skills: unknown[] = Array.isArray(profile?.skills) ? profile.skills : [];
  const education: Partial<ProfileEducation>[] = Array.isArray(profile?.education) ? profile.education : [];
  const experience: Partial<ProfileExperience>[] = Array.isArray(profile?.experience) ? profile.experience : [];
  return {
    fullName: text(profile?.fullName),
    headline: text(profile?.headline),
    location: text(profile?.location),
    summary: text(profile?.summary),
    email: text(profile?.email),
    phone: text(profile?.phone),
    linkedin: text(profile?.linkedin),
    github: text(profile?.github),
    portfolio: text(profile?.portfolio),
    skills: skills.filter((skill): skill is string => typeof skill === "string"),
    // Keyed by position: the saved list has no ids and only changes on a save,
    // which is also when these rows are rebuilt.
    education: education.map((entry, index) => ({
      id: `saved-${index}`,
      school: text(entry?.school),
      degree: text(entry?.degree),
      dates: text(entry?.dates),
      location: text(entry?.location),
      detail: text(entry?.detail),
    })),
    experience: experience.map((entry, index) => ({
      id: `saved-exp-${index}`,
      company: text(entry?.company),
      title: text(entry?.title),
      dates: text(entry?.dates),
      location: text(entry?.location),
      bullets: Array.isArray(entry?.bullets) ? entry.bullets.filter((bullet): bullet is string => typeof bullet === "string") : [],
    })),
  };
}

type LinkKind = "linkedin" | "github" | "portfolio";

/** The parser labels LinkedIn and GitHub by host and anything it does not know as "Portfolio"; a hand-built resume may say "Website". */
const PORTFOLIO_LABEL = /^(portfolio|website|personal (site|website)|homepage|home page|site|blog|dribbble|behance)$/i;

function linkKind(link: ResumeLink): LinkKind | null {
  const url = line(link?.url, Number.MAX_SAFE_INTEGER);
  const label = line(link?.label, 80);
  if (!url) return null;
  // The address outranks the label: "My work" pointing at github.com is GitHub.
  if (/(^|[/.])linkedin\.[a-z]/i.test(url)) return "linkedin";
  // github.com only: a `name.github.io` address is a site someone built, i.e. a portfolio.
  if (/(^|[/.])github\.com/i.test(url)) return "github";
  if (/linkedin/i.test(label)) return "linkedin";
  if (/github/i.test(label)) return "github";
  return PORTFOLIO_LABEL.test(label) ? "portfolio" : null;
}

/**
 * A resume's links as the profile's three: the first LinkedIn, the first
 * GitHub, and the portfolio — `content.portfolio` when the parser set it, else
 * the first link labelled as one. Twitter, Medium and the rest have no field
 * on the profile and are left out rather than squeezed into "Portfolio".
 */
export function linksFromResume(content: Pick<ResumeContent, "links" | "portfolio">): Record<LinkKind, string> {
  const found: Record<LinkKind, string> = { linkedin: "", github: "", portfolio: line(content.portfolio, PROFILE_LIMITS.link) };
  for (const link of Array.isArray(content.links) ? content.links : []) {
    const kind = linkKind(link);
    if (kind && !found[kind]) found[kind] = line(link.url, PROFILE_LIMITS.link);
  }
  return found;
}

/** The resume's education as profile entries: cleaned, schoolless ones dropped, at most 10. */
export function educationFromResume(content: Pick<ResumeContent, "education">): ProfileEducation[] {
  const rows = Array.isArray(content.education) ? content.education : [];
  return rows
    .map((entry) => cleanEducation(entry))
    .filter((entry): entry is ProfileEducation => entry !== null)
    .slice(0, EDUCATION_LIMITS.entries);
}

/**
 * The resume's roles as profile experience: role -> title, company, dates, location (when the
 * parser read one) and the bullets as written. Cleaned, roles with neither a company nor a title
 * dropped, at most 20.
 */
export function experienceFromResume(content: Pick<ResumeContent, "experience">): ProfileExperience[] {
  const rows = Array.isArray(content.experience) ? content.experience : [];
  return rows
    .map((entry) =>
      // `location` is not on the parser's type yet; read it when it is there.
      cleanExperience({ company: entry?.company, title: entry?.role, dates: entry?.dates, location: (entry as { location?: string } | null)?.location, bullets: entry?.bullets }),
    )
    .filter((entry): entry is ProfileExperience => entry !== null)
    .slice(0, EXPERIENCE_LIMITS.entries);
}

/**
 * A headline without the name in front of it. A resume that sets name and title on one line
 * ("Ada Obi  Product Designer") can reach the form as a title that starts with the name; the
 * name comes off, with any separator after it. Whole words only — "Adaeze" does not start with
 * "Ada". A title that is only the name leaves nothing.
 */
export function headlineWithoutName(title: string, names: readonly (string | null | undefined)[]): string {
  const headline = line(title, Number.MAX_SAFE_INTEGER);
  for (const raw of names) {
    const name = line(raw, Number.MAX_SAFE_INTEGER);
    if (!name || headline.length < name.length || headline.slice(0, name.length).toLowerCase() !== name.toLowerCase()) continue;
    const rest = headline.slice(name.length);
    if (rest && !/^[^\p{L}\p{N}]/u.test(rest)) continue;
    return rest.replace(/^[\s,|·•—–\-:/]+/, "").trim();
  }
  return headline;
}

export interface Prefill {
  /** Only the fields that were blank and that the resume had something for. */
  patch: Partial<ProfileForm>;
  /** Those fields, in form order — what the notice says was filled. */
  filled: ProfileField[];
  /** Skills the resume had past the 60 the profile keeps, when it filled Skills; the notice names them. */
  skillsLeftOut: string[];
}

/** Keys for the rows a prefill adds: a stamp the caller took in its event handler, so two imports never share keys. */
export type RowId = (index: number, list: "education" | "experience") => string;

/**
 * What a parsed resume adds to the form: every blank field it has a value for,
 * and nothing else. `rowId` keys the education and experience rows it adds.
 */
export function prefillFromResume(form: ProfileForm, content: ResumeContent, rowId: RowId = (index, list) => `resume-${list}-${index}`): Prefill {
  const patch: Partial<ProfileForm> = {};
  const filled: ProfileField[] = [];
  const offer = <K extends ProfileField>(field: K, value: ProfileForm[K], isEmpty: boolean) => {
    if (!isEmpty) return;
    patch[field] = value;
    filled.push(field);
  };
  const scalar = (field: Exclude<ProfileField, "skills" | "education" | "experience">, value: string) =>
    offer(field, value, blank(form[field]) && !blank(value));

  const links = linksFromResume(content);
  scalar("fullName", line(content.name, PROFILE_LIMITS.fullName));
  scalar("headline", line(headlineWithoutName(typeof content.title === "string" ? content.title : "", [content.name, form.fullName]), PROFILE_LIMITS.headline));
  scalar("location", line(content.location, PROFILE_LIMITS.location));
  scalar("summary", prose(content.summary, PROFILE_LIMITS.summary));
  scalar("email", line(content.email, PROFILE_LIMITS.email));
  scalar("phone", line(content.phone, PROFILE_LIMITS.phone));

  const skills = skillsFromResume(Array.isArray(content.skills) ? content.skills : []);
  offer("skills", skills.skills, cleanSkills(form.skills).length === 0 && skills.skills.length > 0);

  const education = educationFromResume(content);
  offer(
    "education",
    education.map((entry, index) => ({ id: rowId(index, "education"), ...entry })),
    schoolCount(form.education) === 0 && education.length > 0,
  );

  const experience = experienceFromResume(content);
  offer(
    "experience",
    experience.map((entry, index) => ({ id: rowId(index, "experience"), ...entry })),
    roleCount(form.experience) === 0 && experience.length > 0,
  );

  scalar("linkedin", links.linkedin);
  scalar("github", links.github);
  scalar("portfolio", links.portfolio);

  return { patch, filled, skillsLeftOut: "skills" in patch ? skills.leftOut : [] };
}

/** Editor rows back to the saved shape (the editor's ids dropped), as typed — `cleanEducation` is the save's job. */
export const educationOf = (rows: readonly EducationRow[]): ProfileEducation[] =>
  rows.map(({ school, degree, dates, location, detail }) => ({ school, degree, dates, location, detail }));

/** Rows with something in them but no school: the backend would refuse the whole save, so the form asks first. */
export function educationProblems(rows: readonly EducationRow[]): string[] {
  return rows
    .filter((row) => blank(row.school) && [row.degree, row.dates, row.location, row.detail].some((value) => !blank(value)))
    .map((row) => row.id);
}

/** Editor rows back to the saved shape, as typed — `cleanExperience` is the save's job. */
export const experienceOf = (rows: readonly ExperienceRow[]): ProfileExperience[] =>
  rows.map(({ company, title, dates, location, bullets }) => ({ company, title, dates, location, bullets }));

/** Roles with something in them but neither a company nor a title: refused by the backend, so the form asks first. */
export function experienceProblems(rows: readonly ExperienceRow[]): string[] {
  return rows
    .filter((row) => blank(row.company) && blank(row.title) && ([row.dates, row.location].some((value) => !blank(value)) || row.bullets.some((bullet) => !blank(bullet))))
    .map((row) => row.id);
}

/** Saved roles, as the PUT sends them: cleaned, empty rows dropped, at most 20. */
export const experienceToSave = (rows: readonly Partial<ProfileExperience>[]): ProfileExperience[] =>
  rows
    .map((row) => cleanExperience(row))
    .filter((entry): entry is ProfileExperience => entry !== null)
    .slice(0, EXPERIENCE_LIMITS.entries);

/**
 * The PUT body for what changed. Only the edited fields go: sending an
 * untouched name or email back would pin the account's own (which the profile
 * shows when its own is blank) onto the profile for good. Rows with nothing in
 * them are dropped; `educationProblems` is what stops a half-filled one.
 */
export function toProfilePatch(draft: Partial<ProfileForm>): Partial<ProfileSettings> {
  const patch: Partial<ProfileSettings> = {};
  if (draft.fullName !== undefined) patch.fullName = line(draft.fullName, PROFILE_LIMITS.fullName);
  if (draft.headline !== undefined) patch.headline = line(draft.headline, PROFILE_LIMITS.headline);
  if (draft.location !== undefined) patch.location = line(draft.location, PROFILE_LIMITS.location);
  if (draft.summary !== undefined) patch.summary = prose(draft.summary, PROFILE_LIMITS.summary);
  if (draft.email !== undefined) patch.email = line(draft.email, PROFILE_LIMITS.email);
  if (draft.phone !== undefined) patch.phone = line(draft.phone, PROFILE_LIMITS.phone);
  if (draft.linkedin !== undefined) patch.linkedin = line(draft.linkedin, PROFILE_LIMITS.link);
  if (draft.github !== undefined) patch.github = line(draft.github, PROFILE_LIMITS.link);
  if (draft.portfolio !== undefined) patch.portfolio = line(draft.portfolio, PROFILE_LIMITS.link);
  if (draft.skills !== undefined) patch.skills = cleanSkills(draft.skills);
  if (draft.education !== undefined) {
    patch.education = draft.education
      .map((row) => cleanEducation(row))
      .filter((entry): entry is ProfileEducation => entry !== null)
      .slice(0, EDUCATION_LIMITS.entries);
  }
  if (draft.experience !== undefined) patch.experience = experienceToSave(draft.experience);
  return patch;
}

/**
 * Whether the form, as it stands, satisfies a checklist item — the backend's
 * rule mirrored (every item is a field of this form), so the checklist ticks
 * the moment the form holds a valid value, saved or not (`liveOnboarding`).
 * Work experience is never asked: it is not an item.
 */
export function formSatisfies(id: OnboardingItemId, form: ProfileForm): boolean {
  switch (id) {
    case "fullName":
    case "email":
    case "summary":
    case "headline":
    case "location":
      return !blank(form[id]);
    case "skills":
      return cleanSkills(form.skills).length >= MIN_SKILLS;
    case "education":
      return schoolCount(form.education) > 0;
    default:
      // An id this build doesn't know (a newer server's): not the form's to say.
      return false;
  }
}

/**
 * The server's checklist as the form stands right now: an item whose field has an unsaved edit is
 * done exactly when the form satisfies it; every other item keeps the server's answer, which
 * stays the truth for anything saved. So a field filled from a resume ticks at once — there is no
 * "filled in, not saved" — and the save bar is what says there are unsaved changes. An id this
 * build has no field for (a newer server's) keeps the server's answer too. Same order and labels
 * as the server's; `ready` is every item done.
 */
export function liveOnboarding(onboarding: Onboarding, form: ProfileForm, draft: Partial<ProfileForm>): Onboarding {
  const items: OnboardingItem[] = onboarding.items.map((item) => {
    const field: ProfileField | undefined = ITEM_FIELD[item.id];
    const done = field !== undefined && field in draft ? formSatisfies(item.id, form) : item.done;
    return done === item.done ? item : { ...item, done };
  });
  return { ready: items.every((item) => item.done), items, missing: items.filter((item) => !item.done).map((item) => item.id) };
}

// ---------------------------------------------------------------------------
// The form's state: unsaved edits over the saved profile
// ---------------------------------------------------------------------------
//
// The SettingsProvider pattern: the server's profile and the user's edits are
// held apart and layered at read time, so a refetch never clobbers a field
// being typed and no effect mirrors server data into local state. A reducer
// because a prefill has to read the edits made while the resume was being
// parsed — which a stale closure would not see.

export interface FormState {
  draft: Partial<ProfileForm>;
  /** What the last resume filled, for the notice; null when nothing was imported (or it was dismissed). */
  prefilled: ProfileField[] | null;
  /** Skills that resume had past the profile's 60, for the same notice. */
  skillsLeftOut: string[];
}

export type FormAction =
  | { type: "edit"; patch: Partial<ProfileForm> }
  | { type: "prefill"; base: ProfileForm; content: ResumeContent; stamp: string }
  | { type: "saved"; sent: Partial<ProfileForm> }
  | { type: "dismiss-prefill" };

export const EMPTY_FORM_STATE: FormState = { draft: {}, prefilled: null, skillsLeftOut: [] };

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "edit":
      return { ...state, draft: { ...state.draft, ...action.patch } };
    case "prefill": {
      const { patch, filled, skillsLeftOut } = prefillFromResume({ ...action.base, ...state.draft }, action.content, (index, list) => `${action.stamp}-${list}-${index}`);
      return { draft: { ...state.draft, ...patch }, prefilled: filled, skillsLeftOut };
    }
    case "saved": {
      // Only what was sent AND not edited again while the save was in flight:
      // a keystroke made during the request stays a draft.
      const draft = { ...state.draft };
      for (const key of Object.keys(action.sent) as ProfileField[]) {
        if (draft[key] === action.sent[key]) delete draft[key];
      }
      return { draft, prefilled: null, skillsLeftOut: [] };
    }
    case "dismiss-prefill":
      return { ...state, prefilled: null, skillsLeftOut: [] };
  }
}
