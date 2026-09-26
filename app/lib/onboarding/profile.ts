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
// school with a name — and are then filled whole rather than merged, so a
// curated skills list never grows thirty parser guesses on the end of it.

import type { ResumeContent, ResumeLink } from "@/app/lib/dashboard/types";
import type { OnboardingItemId, ProfileEducation, ProfileSettings } from "@/app/lib/settings/types";

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
  skills: 40,
} as const;

export const EDUCATION_LIMITS = { entries: 10, school: 160, degree: 160, dates: 60, location: 120, detail: 500 } as const;

/** The backend's `ELIGIBILITY_MIN_SKILLS`: "enough skills" means one thing across the product. */
export const MIN_SKILLS = 3;

/** An education row in the editor: the saved shape plus a key of the editor's own (the server keeps none). */
export interface EducationRow extends ProfileEducation {
  id: string;
}

/** Everything the onboarding form edits. Phone and the three links are optional; the rest are checklist items. */
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
};

/**
 * The field each checklist item is fixed in — the same name, since the checklist and the form both
 * follow the profile. A Record, not a list, so an item added to `OnboardingItemId` fails to compile
 * here until it has a field. Every item is one of this form's: a resume is not an item (a resume
 * can be built from the profile; the page only offers to start from one).
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

/**
 * The item a URL hash names, or null: `/onboarding#education` opens the form at Education. The
 * extension's "Finish your profile" links and chat's "this is missing" buttons are built on these
 * ids (`OnboardingItemId`), so this is their contract with the page. Forgiving about case and a
 * missing `#` (a hand-typed `#fullname` still lands); anything else — `#onb-profile`, junk, a
 * malformed escape — is not an item, and the page opens at the top as usual.
 */
export function itemFromHash(hash: string | null | undefined): OnboardingItemId | null {
  let wanted: string;
  try {
    wanted = decodeURIComponent((hash ?? "").replace(/^#/, "")).trim().toLowerCase();
  } catch {
    return null;
  }
  if (!wanted) return null;
  return (Object.keys(ITEM_FIELD) as OnboardingItemId[]).find((id) => id.toLowerCase() === wanted) ?? null;
}

const blank = (value: string | null | undefined): boolean => !value || value.trim().length === 0;

/** One line: inner runs of whitespace (a PDF's line wraps) collapse to one space. */
const line = (value: unknown, max: number): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max).trim() : "");

/** Prose keeps its paragraphs; only the ends are trimmed. */
const prose = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max).trim() : "");

/** Rows that name a school — the only ones the backend accepts, and the only ones the checklist counts. */
export const schoolCount = (rows: readonly Pick<ProfileEducation, "school">[]): number => rows.filter((row) => !blank(row.school)).length;

/** Skills as the backend keeps them: trimmed, one space inside, none over 60 characters, no case-insensitive repeats, at most 40. */
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

/** The saved profile as the form starts from it. Defensive: a cached profile may predate `education`. */
export function formFromProfile(profile: Partial<ProfileSettings> | null | undefined): ProfileForm {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const skills: unknown[] = Array.isArray(profile?.skills) ? profile.skills : [];
  const education: Partial<ProfileEducation>[] = Array.isArray(profile?.education) ? profile.education : [];
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

export interface Prefill {
  /** Only the fields that were blank and that the resume had something for. */
  patch: Partial<ProfileForm>;
  /** Those fields, in form order — what the notice says was filled. */
  filled: ProfileField[];
}

/**
 * What a parsed resume adds to the form: every blank field it has a value for,
 * and nothing else. `rowId` keys the education rows it adds (the caller passes
 * a stamp taken in its event handler, so two imports never share keys).
 */
export function prefillFromResume(form: ProfileForm, content: ResumeContent, rowId: (index: number) => string = (index) => `resume-${index}`): Prefill {
  const patch: Partial<ProfileForm> = {};
  const filled: ProfileField[] = [];
  const offer = <K extends ProfileField>(field: K, value: ProfileForm[K], isEmpty: boolean) => {
    if (!isEmpty) return;
    patch[field] = value;
    filled.push(field);
  };
  const scalar = (field: Exclude<ProfileField, "skills" | "education">, value: string) => offer(field, value, blank(form[field]) && !blank(value));

  const links = linksFromResume(content);
  scalar("fullName", line(content.name, PROFILE_LIMITS.fullName));
  scalar("headline", line(content.title, PROFILE_LIMITS.headline));
  scalar("location", line(content.location, PROFILE_LIMITS.location));
  scalar("summary", prose(content.summary, PROFILE_LIMITS.summary));
  scalar("email", line(content.email, PROFILE_LIMITS.email));
  scalar("phone", line(content.phone, PROFILE_LIMITS.phone));

  const skills = cleanSkills(Array.isArray(content.skills) ? content.skills : []);
  offer("skills", skills, cleanSkills(form.skills).length === 0 && skills.length > 0);

  const education = educationFromResume(content);
  offer(
    "education",
    education.map((entry, index) => ({ id: rowId(index), ...entry })),
    schoolCount(form.education) === 0 && education.length > 0,
  );

  scalar("linkedin", links.linkedin);
  scalar("github", links.github);
  scalar("portfolio", links.portfolio);

  return { patch, filled };
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
  return patch;
}

/**
 * Whether the form, as it stands, would satisfy a checklist item — the
 * backend's rule mirrored (every item is a field of this form), so an item
 * can say "filled — save to count" before the save lands. The server's answer
 * is still the only one that ticks anything.
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
}

export type FormAction =
  | { type: "edit"; patch: Partial<ProfileForm> }
  | { type: "prefill"; base: ProfileForm; content: ResumeContent; stamp: string }
  | { type: "saved"; sent: Partial<ProfileForm> }
  | { type: "dismiss-prefill" };

export const EMPTY_FORM_STATE: FormState = { draft: {}, prefilled: null };

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "edit":
      return { ...state, draft: { ...state.draft, ...action.patch } };
    case "prefill": {
      const { patch, filled } = prefillFromResume({ ...action.base, ...state.draft }, action.content, (index) => `${action.stamp}-${index}`);
      return { draft: { ...state.draft, ...patch }, prefilled: filled };
    }
    case "saved": {
      // Only what was sent AND not edited again while the save was in flight:
      // a keystroke made during the request stays a draft.
      const draft = { ...state.draft };
      for (const key of Object.keys(action.sent) as ProfileField[]) {
        if (draft[key] === action.sent[key]) delete draft[key];
      }
      return { draft, prefilled: null };
    }
    case "dismiss-prefill":
      return { ...state, prefilled: null };
  }
}
