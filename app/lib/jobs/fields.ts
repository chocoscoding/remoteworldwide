// The job picker's field vocabulary, and the "A, B, C" spec a screen uses to
// ask for exactly the fields it needs.
//
// One constant, `JOB_FIELDS`, feeds both halves: the template-literal types
// that refuse a bad spec at compile time, and `parseFieldSpec`, which refuses
// the same spec at runtime with the same words. They live side by side in this
// file because the moment they disagree, a spec the compiler accepted throws in
// production (or one it refused would have worked), and neither shows up until
// a screen breaks. `fields.typetest.ts` pins the type half.
//
// `JobDetails` itself belongs to the cross-repo contract in `./types`. This file
// only decides which of its keys a caller may ask for, and what comes back.
//
// Isomorphic and dependency-free on purpose: the picker provider imports it in
// the browser, so nothing here may drag a server module into the client bundle.

import { JOB_SOURCES, type JobDetails, type JobFieldSource, type JobSource } from "./types";

// Re-exported so a screen can import the whole picker vocabulary from one place;
// `./types` stays the owner.
export type { JobDetails, JobFieldSource, JobSource } from "./types";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Every field a screen can ask the picker for, one per key of `JobDetails`.
 *
 * Listing a key `JobDetails` lacks fails in this file (the types below index
 * `JobDetails` by it). The opposite drift, a field added to the contract but
 * not here, is caught by the type test, so it fails the build instead of being
 * silently impossible to ask for.
 */
export const JOB_FIELDS = [
  "id", "source", "company", "role", "description", "url", "salary",
  "platformJobId", "slug", "applyUrl", "category", "regions", "seniority", "postedAt",
  "companyLogo", "companyWebsite", "companyAbout", "companyLinkedin", "descriptionHtml",
  "summary", "location", "remoteType", "employmentType",
  "salaryMin", "salaryMax", "salaryCurrency", "salaryPeriod",
  "requirements", "responsibilities", "niceToHaves", "benefits", "skills",
  "yearsExperienceMin", "yearsExperienceMax",
] as const;
export type JobField = (typeof JOB_FIELDS)[number];

/** Keys whose value is a list, computed from the contract so it cannot fall behind it. */
export type ListJobField = { [K in JobField]: JobDetails[K] extends readonly unknown[] ? K : never }[JobField];

/** The runtime twin of `ListJobField`; the type test asserts they hold the same names. */
export const LIST_JOB_FIELDS = [
  "regions",
  "requirements",
  "responsibilities",
  "niceToHaves",
  "benefits",
  "skills",
] as const satisfies readonly ListJobField[];

/**
 * The only fields a spec may name without `?`.
 *
 * A required field is a promise in the caller's types (`job.description` is
 * `string`, not `string | null`), so only fields the picker can keep that
 * promise for qualify: `id` and `source`, which it always sets; the four form
 * fields the dialog can refuse to save without; and list fields, where `[]` is
 * a true answer. `salary` is a form field too, but many postings never state
 * one, and a dialog that insisted would push people into typing "n/a". Every
 * other field depends on what the posting happened to say.
 */
export type RequirableJobField = "id" | "source" | "company" | "role" | "description" | "url" | ListJobField;

export const REQUIRABLE_FIELDS = [
  "id",
  "source",
  "company",
  "role",
  "description",
  "url",
  ...LIST_JOB_FIELDS,
] as const satisfies readonly RequirableJobField[];

/** Who fills a field: the picker itself, the user in the form, a Remote Worldwide listing, or the import's extraction. */
export const JOB_FIELD_TIERS = ["always", "form", "listing", "derived"] as const;
export type JobFieldTier = (typeof JOB_FIELD_TIERS)[number];

/** How the dialog lets someone type a field. `none` means only a listing or an import can fill it. */
export const JOB_FIELD_INPUTS = ["text", "textarea", "url", "none"] as const;
export type JobFieldInput = (typeof JOB_FIELD_INPUTS)[number];

export interface JobFieldMeta {
  /** What the dialog calls the field, including when it names a required field that is still empty. */
  label: string;
  tier: JobFieldTier;
  input: JobFieldInput;
}

/**
 * Presentation facts for every field, in one table so the dialog never
 * hard-codes a field list of its own that the spec could outgrow.
 *
 * The form labels match the dialog's existing copy ("Position", not "Role").
 * `location` is the one derived field with an input: users may edit it on a
 * saved job (`EDITABLE_JOB_FIELDS`) and it is free text, so a screen asking for
 * `location?` gets a box under More details instead of a value only an import
 * can supply. `remoteType` and `employmentType` are editable too, but they are
 * closed enums and there is no select input kind yet, so they stay `none`.
 */
export const JOB_FIELD_META: Record<JobField, JobFieldMeta> = {
  id: { label: "Saved job", tier: "always", input: "none" },
  source: { label: "Source", tier: "always", input: "none" },

  company: { label: "Company", tier: "form", input: "text" },
  role: { label: "Position", tier: "form", input: "text" },
  description: { label: "Description", tier: "form", input: "textarea" },
  url: { label: "Posting link", tier: "form", input: "url" },
  salary: { label: "Salary", tier: "form", input: "text" },

  platformJobId: { label: "Remote Worldwide listing", tier: "listing", input: "none" },
  slug: { label: "Listing slug", tier: "listing", input: "none" },
  applyUrl: { label: "Apply link", tier: "listing", input: "none" },
  category: { label: "Category", tier: "listing", input: "none" },
  regions: { label: "Regions", tier: "listing", input: "none" },
  seniority: { label: "Seniority", tier: "listing", input: "none" },
  postedAt: { label: "Posted", tier: "listing", input: "none" },
  companyLogo: { label: "Company logo", tier: "listing", input: "none" },
  companyWebsite: { label: "Company website", tier: "listing", input: "none" },
  companyAbout: { label: "About the company", tier: "listing", input: "none" },
  companyLinkedin: { label: "Company LinkedIn", tier: "listing", input: "none" },
  descriptionHtml: { label: "Formatted description", tier: "listing", input: "none" },

  summary: { label: "Summary", tier: "derived", input: "none" },
  location: { label: "Location", tier: "derived", input: "text" },
  remoteType: { label: "Remote or on-site", tier: "derived", input: "none" },
  employmentType: { label: "Employment type", tier: "derived", input: "none" },
  salaryMin: { label: "Salary from", tier: "derived", input: "none" },
  salaryMax: { label: "Salary to", tier: "derived", input: "none" },
  salaryCurrency: { label: "Salary currency", tier: "derived", input: "none" },
  salaryPeriod: { label: "Pay period", tier: "derived", input: "none" },
  requirements: { label: "Requirements", tier: "derived", input: "none" },
  responsibilities: { label: "Responsibilities", tier: "derived", input: "none" },
  niceToHaves: { label: "Nice to haves", tier: "derived", input: "none" },
  benefits: { label: "Benefits", tier: "derived", input: "none" },
  skills: { label: "Skills", tier: "derived", input: "none" },
  yearsExperienceMin: { label: "Minimum experience", tier: "derived", input: "none" },
  yearsExperienceMax: { label: "Maximum experience", tier: "derived", input: "none" },
};

// ---------------------------------------------------------------------------
// The spec, at compile time
//
// Each problem is a string literal type, so a bad spec's compile error reads
// `... not assignable to parameter of type '"Unknown job field \"rol\""'`
// instead of a wall of `never`. Every recursion is in tail position, which
// keeps a spec of all 34 fields well inside TypeScript's 1,000-step limit.
// ---------------------------------------------------------------------------

type WS = " " | "\n" | "\t" | "\r";
type TrimStart<S extends string> = S extends `${WS}${infer R}` ? TrimStart<R> : S;
type TrimEnd<S extends string> = S extends `${infer R}${WS}` ? TrimEnd<R> : S;
type Trim<S extends string> = TrimEnd<TrimStart<S>>;

type Entry = { name: string; optional: boolean };
type ParseEntry<Raw extends string> =
  Trim<Raw> extends `${infer N}?` ? { name: Trim<N>; optional: true } : { name: Trim<Raw>; optional: false };

// Empty entries are skipped wherever they fall, which is what makes a trailing
// comma (and a spec split one field per line) legal.
type Parse<S extends string, Acc extends Entry[] = []> =
  S extends `${infer H},${infer T}`
    ? Parse<T, Trim<H> extends "" ? Acc : [...Acc, ParseEntry<H>]>
    : Trim<S> extends "" ? Acc : [...Acc, ParseEntry<S>];

type FirstProblem<E extends Entry[], Seen extends string = never> =
  E extends [infer H extends Entry, ...infer R extends Entry[]]
    ? H["name"] extends JobField
      ? H["name"] extends Seen
        ? `Job field "${H["name"]}" is listed twice`
        : H["optional"] extends true
          ? FirstProblem<R, Seen | H["name"]>
          : H["name"] extends RequirableJobField
            ? FirstProblem<R, Seen | H["name"]>
            : `Job field "${H["name"]}" is not guaranteed for every job, ask for "${H["name"]}?"`
      : `Unknown job field "${H["name"]}"`
    : never;

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

// A union of specs is refused, not just discouraged: `Parse` distributes over
// it, so `PickedJob` would promise the fields of every member at once while the
// runtime only ever parses the one string it was actually given.
type SpecProblem<S extends string> =
  string extends S ? "Pass a literal field spec like \"company, role\" (for a runtime list use pickJobDynamic)"
  : true extends IsUnion<S> ? "Pass one literal field spec per call, not a union of specs"
  : Parse<S> extends [] ? "The field spec is empty"
  : FirstProblem<Parse<S>>;

/**
 * `S` when the spec is valid, otherwise a sentence naming the first problem.
 *
 * Use it as the parameter type itself (`fields: ValidSpec<S>`), never as
 * `S & ValidSpec<S>`: that intersection collapses to `never` and turns every
 * helpful message into an unreadable one.
 */
export type ValidSpec<S extends string> = [SpecProblem<S>] extends [never] ? S : SpecProblem<S>;

type Parsed<S extends string> = Parse<S>[number];
type ReqKeys<S extends string> = Extract<Extract<Parsed<S>, { optional: false }>["name"], JobField>;
type OptKeys<S extends string> = Exclude<Extract<Extract<Parsed<S>, { optional: true }>["name"], JobField>, ReqKeys<S>>;
type Prettify<T> = { [K in keyof T]: T[K] } & {};

// An optional list field is still never `null`: the picker answers "none" with
// `[]`, so `string[] | null` would only make every caller write `?? []`.
type OptionalValue<K extends JobField> = JobDetails[K] extends readonly unknown[] ? JobDetails[K] : JobDetails[K] | null;

export interface PickedJobMeta<F extends JobField = JobField> {
  /** Requested fields the job has nothing for: `null`, or `[]` for a list. */
  missing: Array<Exclude<F, "id" | "source">>;
  /** Where each requested field's value came from, when anyone recorded it. */
  sources: Partial<Record<F, JobFieldSource>>;
}

/** What `pickJob(spec)` resolves with: `id`, `source`, exactly the requested fields, and `meta`. */
export type PickedJob<S extends string> = Prettify<
  { id: string; source: JobSource }
  & { [K in ReqKeys<S>]: NonNullable<JobDetails[K]> }
  & { [K in OptKeys<S>]: OptionalValue<K> }
  & { meta: PickedJobMeta<ReqKeys<S> | OptKeys<S>> }
>;

export type PickResult<S extends string> = { status: "picked"; job: PickedJob<S> } | { status: "cancelled" };

// ---------------------------------------------------------------------------
// The picker's API shape — implemented by the provider, declared here so the
// type test can exercise exactly what screens call.
// ---------------------------------------------------------------------------

export const PICKER_STATUSES = ["idle", "open", "loading", "waiting", "error", "success", "closed"] as const;
export type PickerStatus = (typeof PICKER_STATUSES)[number];

export type PickerTab = "platform" | "paste";

export interface PickJobOptions {
  /** Dialog heading, when a screen has something more specific than the default. */
  title?: string;
  initialTab?: PickerTab;
  /** Called on every transition, so a screen can mirror progress without polling `status`. */
  onStatusChange?(status: PickerStatus): void;
}

/** `pickJob` as returned by `useJobPicker()`. The spec must be a literal. */
export type PickJob = <S extends string>(fields: ValidSpec<S>, opts?: PickJobOptions) => Promise<PickResult<S>>;

/**
 * The shape for specs known only at runtime.
 *
 * The compiler cannot see which fields were asked for, so it promises every
 * key and nothing non-null beyond `id` and `source`. To keep that promise the
 * runtime fills every key, not only the requested ones: a requested-only object
 * would leave `job.requirements` undefined under a type that says `string[]`.
 * `meta` still covers only the requested fields.
 */
export type PickedJobDynamic = Prettify<
  { id: string; source: JobSource }
  & { [K in Exclude<JobField, "id" | "source">]: OptionalValue<K> }
  & { meta: PickedJobMeta }
>;

export type PickResultDynamic = { status: "picked"; job: PickedJobDynamic } | { status: "cancelled" };

export type PickJobDynamic = (fields: readonly JobField[], opts?: PickJobOptions) => Promise<PickResultDynamic>;

// ---------------------------------------------------------------------------
// The spec, at runtime
// ---------------------------------------------------------------------------

export interface ParsedFieldSpec {
  /** Named without `?`. Scalars among them gate Save; lists never do, since `[]` keeps the promise. */
  required: JobField[];
  /** Named with `?`: shown under More details, `null` (or `[]`) when the job has nothing. */
  optional: JobField[];
}

export type JobFieldSources = Partial<Record<JobField, JobFieldSource>>;

const FIELD_SET: ReadonlySet<string> = new Set<string>(JOB_FIELDS);
const REQUIRABLE_SET: ReadonlySet<string> = new Set<string>(REQUIRABLE_FIELDS);
const LIST_SET: ReadonlySet<string> = new Set<string>(LIST_JOB_FIELDS);
const SOURCE_SET: ReadonlySet<string> = new Set<string>(JOB_SOURCES);

// Exactly the four characters in `WS` above. Not `String.prototype.trim`, which
// also strips non-breaking and other Unicode spaces: the runtime would then
// accept "company\u00a0", a spec the compiler rejects, and the two halves of
// this file would quietly stop describing the same language.
const SPEC_WHITESPACE: ReadonlySet<string> = new Set([" ", "\n", "\t", "\r"]);

function trimSpec(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && SPEC_WHITESPACE.has(value[start])) start++;
  while (end > start && SPEC_WHITESPACE.has(value[end - 1])) end--;
  return value.slice(start, end);
}

export function isJobField(value: unknown): value is JobField {
  return typeof value === "string" && FIELD_SET.has(value);
}

export function isRequirableField(field: JobField): field is RequirableJobField {
  return REQUIRABLE_SET.has(field);
}

export function isListJobField(field: JobField): field is ListJobField {
  return LIST_SET.has(field);
}

function specError(spec: string, problem: string): Error {
  return new Error(`Invalid job field spec ${JSON.stringify(spec)}: ${problem}`);
}

/**
 * Parse `"company, role, salary?"` into required and optional fields.
 *
 * Throws in every environment, production included, for exactly the specs the
 * compiler refuses and with the same message. Logging and carrying on would
 * resolve an object missing a field its own type claims, which fails far from
 * the cause; the types make this branch unreachable for literal specs anyway,
 * so it only ever fires for a spec that reached here through `any`.
 */
export function parseFieldSpec(spec: string): ParsedFieldSpec {
  if (typeof spec !== "string") {
    throw new Error(`Invalid job field spec: expected a string like "company, role", got ${typeof spec}`);
  }
  const required: JobField[] = [];
  const optional: JobField[] = [];
  const seen = new Set<JobField>();

  // Same order of checks as `FirstProblem`, so the first problem reported is the same one.
  for (const raw of spec.split(",")) {
    const entry = trimSpec(raw);
    if (entry === "") continue;
    const isOptional = entry.endsWith("?");
    const name = isOptional ? trimSpec(entry.slice(0, -1)) : entry;

    if (!isJobField(name)) throw specError(spec, `Unknown job field "${name}"`);
    if (seen.has(name)) throw specError(spec, `Job field "${name}" is listed twice`);
    seen.add(name);

    if (isOptional) optional.push(name);
    else if (isRequirableField(name)) required.push(name);
    else throw specError(spec, `Job field "${name}" is not guaranteed for every job, ask for "${name}?"`);
  }

  if (seen.size === 0) throw specError(spec, "The field spec is empty");
  return { required, optional };
}

/**
 * The runtime-list counterpart of `parseFieldSpec`, for `pickJobDynamic`.
 *
 * A list cannot carry `?`, so each field is treated the way the equivalent
 * literal spec would most naturally write it: requirable fields required,
 * everything else optional. A screen moving from `"company, role"` to
 * `["company", "role"]` then gets the same dialog. The result type stays
 * all-nullable regardless, because the compiler cannot see the list.
 */
export function parseFieldList(fields: readonly JobField[]): ParsedFieldSpec {
  if (!Array.isArray(fields)) {
    throw new Error("Invalid job field list: expected an array of job field names");
  }
  const required: JobField[] = [];
  const optional: JobField[] = [];
  const seen = new Set<JobField>();

  for (const name of fields as readonly unknown[]) {
    if (!isJobField(name)) throw new Error(`Invalid job field list: Unknown job field ${JSON.stringify(name)}`);
    if (seen.has(name)) throw new Error(`Invalid job field list: Job field "${name}" is listed twice`);
    seen.add(name);
    (isRequirableField(name) ? required : optional).push(name);
  }

  if (seen.size === 0) throw new Error("Invalid job field list: The field list is empty");
  return { required, optional };
}

// A whitespace-only string counts as absent. Otherwise a description of "  "
// would satisfy a required `description`, and `meta.missing` would stay silent
// about a field the screen will render as blank.
function isAbsent(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function readField(details: JobDetails, field: JobField): unknown {
  const value: unknown = details[field];
  // Copied, so a screen that sorts or pushes onto its list cannot reach back
  // into the query cache the details came from.
  if (LIST_SET.has(field)) return Array.isArray(value) ? [...value] : [];
  return isAbsent(value) ? null : value;
}

/**
 * Required scalar fields that are still empty, in spec order. The dialog gates
 * Save on this and names what is left; `toPickedJob` refuses to resolve while
 * it is non-empty. `id` and `source` are excluded because the picker, not the
 * user, fills them.
 */
export function unfilledRequiredFields(
  values: Partial<Record<JobField, unknown>>,
  parsed: ParsedFieldSpec,
): JobField[] {
  return parsed.required.filter(
    (field) => field !== "id" && field !== "source" && !LIST_SET.has(field) && isAbsent(values[field]),
  );
}

function project(
  details: JobDetails,
  valueFields: readonly JobField[],
  requested: ReadonlySet<JobField>,
  sources: JobFieldSources,
): Record<string, unknown> {
  const job: Record<string, unknown> = { id: details.id, source: details.source };
  for (const field of valueFields) {
    if (field === "id" || field === "source") continue;
    job[field] = readField(details, field);
  }

  // Walk the canonical order rather than the spec's, so `missing` reads the
  // same however a screen happened to order its spec.
  const missing: JobField[] = [];
  const picked: JobFieldSources = {};
  for (const field of JOB_FIELDS) {
    if (!requested.has(field)) continue;
    if (field !== "id" && field !== "source" && isAbsent(job[field])) missing.push(field);
    const from = sources[field];
    if (from !== undefined) picked[field] = from;
  }

  job.meta = { missing, sources: picked };
  return job;
}

/**
 * Build the object `PickedJob` describes: `id` and `source`, every requested
 * field (`null` for an absent scalar, `[]` for an absent list), and `meta`
 * limited to the requested fields. Untyped because the spec's type is gone by
 * the time the parsed form reaches here; `toPickedJob` puts it back.
 */
export function projectPickedJob(details: JobDetails, parsed: ParsedFieldSpec, sources: JobFieldSources): unknown {
  const requested = new Set<JobField>([...parsed.required, ...parsed.optional]);
  return project(
    details,
    JOB_FIELDS.filter((field) => requested.has(field)),
    requested,
    sources,
  );
}

// The last line of defence for the promise in the caller's types. Each of these
// is a provider bug, never a user error, because the dialog gates Save on the
// same check, so throwing is the honest outcome rather than resolving a job
// whose `description: string` is secretly `null`.
function assertPickable(details: JobDetails, parsed: ParsedFieldSpec): void {
  if (typeof details.id !== "string" || details.id.trim() === "") {
    throw new Error("Cannot resolve a picked job without a saved job id: every pick must upsert a saved job first");
  }
  if (!SOURCE_SET.has(details.source)) {
    throw new Error(`Cannot resolve a picked job with an unknown source ${JSON.stringify(details.source)}`);
  }
  const unfilled = unfilledRequiredFields(details, parsed);
  if (unfilled.length > 0) {
    throw new Error(
      `Cannot resolve a picked job with required fields still empty (${unfilled.join(", ")}): ` +
        "the dialog must not save until unfilledRequiredFields() is empty",
    );
  }
}

/**
 * The typed projection the provider resolves `pickJob` with.
 *
 * `S` must be the spec `parsed` came from; inside the provider's generic
 * `pickJob<S>` that is simply `toPickedJob<S>(details, parsed, sources)`.
 * Throws when the job cannot honour the spec's required fields (see
 * `assertPickable`).
 */
export function toPickedJob<S extends string>(
  details: JobDetails,
  parsed: ParsedFieldSpec,
  sources: JobFieldSources,
): PickedJob<S> {
  assertPickable(details, parsed);
  return projectPickedJob(details, parsed, sources) as PickedJob<S>;
}

/** The typed projection for `pickJobDynamic`: every field filled, `meta` for the requested ones only. */
export function toPickedJobDynamic(
  details: JobDetails,
  parsed: ParsedFieldSpec,
  sources: JobFieldSources,
): PickedJobDynamic {
  assertPickable(details, parsed);
  const requested = new Set<JobField>([...parsed.required, ...parsed.optional]);
  return project(details, JOB_FIELDS, requested, sources) as unknown as PickedJobDynamic;
}
