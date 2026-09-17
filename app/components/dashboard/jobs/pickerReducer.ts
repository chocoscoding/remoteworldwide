// The job picker's state machine, as a pure reducer.
//
// One `phase` at a time is the point. A modal that keeps `loading`, `error`
// and `success` as separate booleans eventually shows a spinner under an error
// message, and nothing in its types stops it. Here every screen state is one
// member of a union, so "reading the link" and "that link can't be opened"
// cannot render together.
//
// Waiting is not a phase. It is derived from how long the running phase has
// been going (the dialog times the run `runningKey` names), so it can never
// fall out of step with the request it describes. A stored `waiting: true`
// would need a timer of its own to set it and every exit path to clear it.
//
// No clock is read here or carried in any action. Times come from the server
// (`updatedAt`) or from the dialog's timer effect, which keeps the reducer pure
// and keeps `Date.now()` out of handlers that the React Compiler has to assume
// could be called during render.
//
// Pure and free of React and fetch, so each transition can be read (and, one
// day, tested) without rendering the dialog. Async results arrive as actions
// carrying the `run` they were started under; a result whose run is no longer
// the current one changes nothing, so a slow answer can never overwrite a newer
// state.

import {
  JOB_FIELDS,
  JOB_FIELD_META,
  unfilledRequiredFields,
  type JobField,
  type ParsedFieldSpec,
  type PickerStatus,
  type PickerTab,
} from "@/app/lib/jobs/fields";
import {
  EDITABLE_JOB_FIELDS,
  type JobDraft,
  type JobImportErrorCode,
  type JobImportItem,
  type JobImportStatus,
  type SaveJobInput,
  type SavedJobItem,
  type UpdateSavedJobInput,
} from "@/app/lib/jobs/types";

// ---------------------------------------------------------------------------
// The form's shape
// ---------------------------------------------------------------------------

/** How long an import or enrichment runs before the dialog shows its live stage, the elapsed time and Cancel. */
export const WAIT_AFTER_MS = 2_500;

/** The backend's SAVED_JOB_DESCRIPTION_MAX_CHARS, itself the AI service's MAX_JD_CHARS: anything saved can be asked about in full. */
export const DESCRIPTION_MAX_CHARS = 60_000;

/**
 * Fields the dialog has an input for, in canonical order. Read from the field
 * table rather than listed here, so a field that gains an input in `fields.ts`
 * appears in the form without a second edit.
 */
export const INPUT_FIELDS: readonly JobField[] = JOB_FIELDS.filter((field) => JOB_FIELD_META[field].input !== "none");

/**
 * Asked for whatever the spec says. A saved job cannot exist without them
 * (`SaveJobInput` requires both) and "Your jobs" lists by them, so even a spec
 * of `"description"` alone gets a Company and a Position box.
 */
const ALWAYS_REQUIRED: readonly JobField[] = ["company", "role"];

export interface FormPlan {
  /** Inputs that gate Save. */
  required: JobField[];
  /** Inputs asked for with `?`, under More details. Every other input stays hidden. */
  optional: JobField[];
  /** The spec plus company and role: what Save waits for, and what a picked job must have before it resolves. */
  gate: ParsedFieldSpec;
}

export function planForm(parsed: ParsedFieldSpec): FormPlan {
  const required = new Set<JobField>([...ALWAYS_REQUIRED, ...parsed.required]);
  const optional = new Set<JobField>(parsed.optional);
  return {
    required: INPUT_FIELDS.filter((field) => required.has(field)),
    optional: INPUT_FIELDS.filter((field) => optional.has(field) && !required.has(field)),
    gate: {
      required: JOB_FIELDS.filter((field) => required.has(field)),
      optional: parsed.optional.filter((field) => !required.has(field)),
    },
  };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** What was pasted. The server makes the real call; this only picks loading and error copy. */
export type ImportInput = "link" | "text";

/** Why an import could not fill the form: the backend's code, or the request failing before there was one. */
export type ImportFailureCode = JobImportErrorCode | "request-failed";

export type PickerPhase =
  | { kind: "idle" }
  // Loading: a listing or saved job was chosen and its full details are on the way.
  | { kind: "picking"; target: string }
  | { kind: "pickError"; target: string; message: string }
  // Loading, then waiting: an import is running. `importId` is null until the POST answers.
  | { kind: "importing"; run: number; input: ImportInput; link: string | null; importId: string | null }
  | {
      kind: "importError";
      input: ImportInput;
      link: string | null;
      code: ImportFailureCode;
      message: string;
      /** Epoch ms when a `limited` window has room again. */
      retryAt: number | null;
    }
  // Success: the import filled the form.
  | { kind: "filled"; origin: ImportInput }
  | { kind: "saving" }
  | { kind: "saveError"; message: string }
  // Loading, then waiting: the job is saved and the derived fields the spec asked for are being extracted.
  | { kind: "enriching"; run: number; job: SavedJobItem; importId: string | null }
  | {
      kind: "enrichError";
      run: number;
      job: SavedJobItem;
      message: string;
      /** False when the backend refused for good (`isLastingEnrichRefusal`): another try would get the same answer. */
      retryable: boolean;
    };

export type ImportFailure = Extract<PickerPhase, { kind: "importError" }>;

export interface FilledMark {
  /** Inputs the import filled and the user has not edited since. Each carries a "from link" mark. */
  fields: JobField[];
  origin: ImportInput;
  /** New on every fill, so the highlight replays even when the same fields fill twice. */
  flash: number;
}

export type FocusTarget = "search" | "paste" | JobField;

export interface PickerState {
  tab: PickerTab;
  query: string;
  raw: string;
  /** "text" once the user was told to paste the posting instead of a link; only the placeholder changes. */
  rawHint: "any" | "text";
  values: Partial<Record<JobField, string>>;
  /** The last successful import's draft. Carries every field it found into Save, shown or not. */
  draft: JobDraft | null;
  /** The import `draft` came from, sent with Save so the saved job keeps its extraction record. */
  importId: string | null;
  filled: FilledMark | null;
  moreOpen: boolean;
  /**
   * A saved job that lacks a field this screen requires. The paste tab becomes
   * a form for finishing it, and Save updates that job instead of adding one.
   */
  editing: SavedJobItem | null;
  /** A request to move focus once the next render has the element. `seq` makes a repeat request a new value. */
  focus: { target: FocusTarget; seq: number } | null;
  gate: ParsedFieldSpec;
  phase: PickerPhase;
}

export type PickerAction =
  | { type: "tab"; tab: PickerTab }
  | { type: "query"; query: string }
  | { type: "raw"; raw: string }
  | { type: "field"; field: JobField; value: string }
  | { type: "toggleMore" }
  | { type: "dismiss"; focus?: FocusTarget }
  | { type: "pickStart"; target: string }
  | { type: "pickFailed"; target: string; message: string }
  | { type: "complete"; job: SavedJobItem; missing: JobField[] }
  | { type: "importStart"; run: number; input: ImportInput; link: string | null }
  | { type: "importAccepted"; run: number; importId: string }
  | { type: "importSettled"; run: number; item: JobImportItem }
  | { type: "importRequestFailed"; run: number; code: ImportFailureCode; message: string }
  | { type: "importCancelled"; run: number }
  | { type: "pasteText" }
  | { type: "saveStart" }
  | { type: "saveFailed"; message: string }
  | { type: "enrichStart"; run: number; job: SavedJobItem }
  | { type: "enrichAccepted"; run: number; importId: string }
  | { type: "enrichFailed"; run: number; job: SavedJobItem; message: string; retryable?: boolean };

const IDLE: PickerPhase = { kind: "idle" };

export function initialPickerState({ initialTab, gate }: { initialTab: PickerTab; gate: ParsedFieldSpec }): PickerState {
  return {
    tab: initialTab,
    query: "",
    raw: "",
    rawHint: "any",
    values: {},
    draft: null,
    importId: null,
    filled: null,
    moreOpen: false,
    editing: null,
    // Nothing to request on open: the dialog's onOpenAutoFocus handles that,
    // after its focus scope has taken over from any dialog underneath.
    focus: null,
    gate,
    phase: IDLE,
  };
}

const focusOn = (state: PickerState, target: FocusTarget): PickerState["focus"] => ({ target, seq: (state.focus?.seq ?? 0) + 1 });

const hasText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

const isEmptyValue = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);

const isErrorPhase = (phase: PickerPhase) =>
  phase.kind === "pickError" || phase.kind === "importError" || phase.kind === "saveError" || phase.kind === "enrichError";

/**
 * When a `limited` window has room again, on the server's clock: an import's
 * `updatedAt` is the moment the limiter answered, which is exactly what
 * `retryAfterMs` counts from. Null if that timestamp did not arrive as a Date.
 */
function retryTime(item: JobImportItem, retryAfterMs: number): number | null {
  const answeredAt = item.updatedAt instanceof Date ? item.updatedAt.getTime() : Number.NaN;
  return Number.isFinite(answeredAt) ? answeredAt + retryAfterMs : null;
}

function valuesOf(source: Partial<Record<JobField, unknown>>): Partial<Record<JobField, string>> {
  const values: Partial<Record<JobField, string>> = {};
  for (const field of INPUT_FIELDS) {
    const value = source[field];
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  const { phase } = state;
  switch (action.type) {
    case "tab": {
      if (action.tab === state.tab) return state;
      // Leaving a half-finished saved job for the list abandons finishing it;
      // coming back to the paste tab should offer a fresh form, not that job.
      const leavingEdit = action.tab === "platform" && state.editing !== null;
      return {
        ...state,
        ...(leavingEdit ? { editing: null, values: {}, draft: null, importId: null, filled: null } : {}),
        tab: action.tab,
        focus: focusOn(state, action.tab === "paste" ? "paste" : "search"),
        phase: phase.kind === "pickError" || (leavingEdit && isErrorPhase(phase)) ? IDLE : phase,
      };
    }

    case "query":
      // A failed pick's message is about the list it happened in; a new search is a new list.
      return { ...state, query: action.query, phase: phase.kind === "pickError" ? IDLE : phase };

    case "raw":
      // The error described what was in the box; editing it makes the message stale.
      return { ...state, raw: action.raw, phase: phase.kind === "importError" ? IDLE : phase };

    case "field": {
      const filled =
        state.filled && state.filled.fields.includes(action.field)
          ? { ...state.filled, fields: state.filled.fields.filter((field) => field !== action.field) }
          : state.filled;
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        filled,
        phase: phase.kind === "saveError" ? IDLE : phase,
      };
    }

    case "toggleMore":
      return { ...state, moreOpen: !state.moreOpen };

    case "dismiss":
      return {
        ...state,
        phase: isErrorPhase(phase) ? IDLE : phase,
        focus: action.focus ? focusOn(state, action.focus) : state.focus,
      };

    case "pickStart":
      return { ...state, phase: { kind: "picking", target: action.target } };

    case "pickFailed":
      return phase.kind === "picking" && phase.target === action.target
        ? { ...state, phase: { kind: "pickError", target: action.target, message: action.message } }
        : state;

    case "complete":
      return {
        ...state,
        tab: "paste",
        editing: action.job,
        values: valuesOf(action.job),
        draft: null,
        importId: null,
        filled: null,
        focus: focusOn(state, action.missing[0] ?? "paste"),
        phase: IDLE,
      };

    case "importStart":
      return {
        ...state,
        phase: {
          kind: "importing",
          run: action.run,
          input: action.input,
          link: action.link,
          importId: null,
        },
      };

    case "importAccepted":
      return phase.kind === "importing" && phase.run === action.run
        ? { ...state, phase: { ...phase, importId: action.importId } }
        : state;

    case "importSettled":
      return settleImport(state, action);

    case "importRequestFailed":
      return phase.kind === "importing" && phase.run === action.run
        ? {
            ...state,
            phase: {
              kind: "importError",
              input: phase.input,
              link: phase.link,
              code: action.code,
              message: action.message,
              retryAt: null,
            },
          }
        : state;

    case "importCancelled":
      return phase.kind === "importing" && phase.run === action.run ? { ...state, phase: IDLE } : state;

    case "pasteText": {
      // The link is not thrown away: it becomes the posting link on the saved
      // job, so "paste the text instead" costs the user nothing they had.
      const link = phase.kind === "importError" ? phase.link : null;
      const values = link && !hasText(state.values.url) ? { ...state.values, url: link } : state.values;
      return {
        ...state,
        values,
        raw: "",
        rawHint: "text",
        focus: focusOn(state, "paste"),
        phase: phase.kind === "importError" ? IDLE : phase,
      };
    }

    case "saveStart":
      return { ...state, phase: { kind: "saving" } };

    case "saveFailed":
      return phase.kind === "saving" ? { ...state, phase: { kind: "saveError", message: action.message } } : state;

    case "enrichStart":
      return {
        ...state,
        phase: { kind: "enriching", run: action.run, job: action.job, importId: null },
      };

    case "enrichAccepted":
      return phase.kind === "enriching" && phase.run === action.run
        ? { ...state, phase: { ...phase, importId: action.importId } }
        : state;

    case "enrichFailed":
      return phase.kind === "enriching" && phase.run === action.run
        ? {
            ...state,
            phase: { kind: "enrichError", run: action.run, job: action.job, message: action.message, retryable: action.retryable ?? true },
          }
        : state;
  }
}

function settleImport(state: PickerState, action: Extract<PickerAction, { type: "importSettled" }>): PickerState {
  const { phase } = state;
  const { item } = action;
  if (phase.kind !== "importing" || phase.run !== action.run || phase.importId !== item.id) return state;

  // The dialog's own Cancel leaves `importing` before its DELETE lands, so an
  // abandoned import that reaches here was stopped somewhere else: the same
  // link cancelled in another tab (both were handed one in-flight import), or a
  // quick second Fill that the backend answered with the id an earlier Cancel
  // was still abandoning. Going quietly idle would stop the spinner with nothing
  // filled and no word why. As a failure it says so and offers Try again, which
  // starts a fresh read now that the old one is no longer in flight.
  if (item.status === "abandoned") {
    return {
      ...state,
      phase: {
        kind: "importError",
        input: phase.input,
        link: phase.link,
        code: "request-failed",
        message: "That read was stopped before it finished. Try again.",
        retryAt: null,
      },
    };
  }

  // `done` without a draft breaks the contract; it is reported, never shown as
  // a success that filled nothing.
  if (item.status === "failed" || (item.status === "done" && item.draft === null)) {
    const error = item.error;
    return {
      ...state,
      phase: {
        kind: "importError",
        input: phase.input,
        link: phase.link,
        code: error?.code ?? "provider-error",
        message: error?.message ?? "",
        retryAt: error && error.retryAfterMs !== null ? retryTime(item, error.retryAfterMs) : null,
      },
    };
  }
  if (item.status !== "done" || item.draft === null) return state;

  // What the user typed is overwritten where the import found a value: they
  // asked for the fields to be filled. What it did not find is left alone.
  const draft: Partial<Record<JobField, unknown>> = item.draft;
  const values = { ...state.values };
  const fields: JobField[] = [];
  for (const field of INPUT_FIELDS) {
    const value = draft[field];
    if (!hasText(value)) continue;
    values[field] = value;
    fields.push(field);
  }

  const origin: ImportInput = item.mode === "text" ? "text" : item.mode === "link" ? "link" : phase.input;
  const firstMissing = unfilledRequiredFields(values, state.gate)[0];
  // A filled `?` field is under More details; opening it is the only way the user sees what arrived.
  const opensMore = fields.some((field) => state.gate.optional.includes(field) && !state.gate.required.includes(field));

  return {
    ...state,
    values,
    draft: item.draft,
    importId: item.id,
    raw: "",
    rawHint: "any",
    filled: { fields, origin, flash: action.run },
    moreOpen: state.moreOpen || opensMore,
    focus: firstMissing ? focusOn(state, firstMissing) : state.focus,
    phase: { kind: "filled", origin },
  };
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

/**
 * Names the run that can turn into waiting (an import or an enrichment), or
 * null when nothing that can wait is running. Another run is another key, so
 * the dialog's timer restarts from zero instead of carrying the last run's time.
 */
export function runningKey(phase: PickerPhase): string | null {
  return phase.kind === "importing" || phase.kind === "enriching" ? `${phase.kind}:${phase.run}` : null;
}

/** The import the dialog should be polling. */
export function watchedImportId(phase: PickerPhase): string | null {
  return phase.kind === "importing" || phase.kind === "enriching" ? phase.importId : null;
}

/** The status `useJobPicker().status` and `onStatusChange` report. `closed` is the provider's to say. */
export function pickerStatusOf(phase: PickerPhase, waiting: boolean): PickerStatus {
  switch (phase.kind) {
    case "idle":
      return "open";
    case "picking":
    case "saving":
      return "loading";
    case "importing":
    case "enriching":
      return waiting ? "waiting" : "loading";
    case "pickError":
    case "importError":
    case "saveError":
    case "enrichError":
      return "error";
    case "filled":
      return "success";
  }
}

/** The live stage a waiting dialog shows, from the import's polled status. */
export function stageCopy(status: JobImportStatus | null, input: ImportInput | "enrich"): string {
  if (status === "extracting") return "Pulling out the details…";
  return input === "link" ? "Reading the page…" : "Reading the posting…";
}

/**
 * What the job list says to a screen reader, through one status region that
 * stays mounted (a region inserted along with its text is often not read). The
 * skeleton and the search box's spinner are silent, and a list that failed to
 * load has an alert of its own, so this covers the rest: that a search is
 * running, and what it found.
 */
export function listAnnouncement(list: { searching: boolean; failed: boolean; nothingFound: boolean; count: number }): string {
  if (list.searching) return "Searching…";
  if (list.nothingFound) return "Nothing matches that.";
  if (list.count === 0 && list.failed) return "";
  return list.count === 1 ? "1 job" : `${list.count} jobs`;
}

/**
 * A single link, with `https://` added when it was pasted without a scheme.
 * Anything else, including a link with other text around it, is sent as text
 * and the server decides whether to crawl the link inside it.
 */
export function linkFrom(input: string): string | null {
  const value = input.trim();
  if (value === "" || /\s/.test(value)) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(value) ? `https://${value}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * The backend's MIN_POSTING_CHARS for an enrichment (`jobImportService.ts`):
 * under it the enrichment is refused as `not-a-posting` before any model call.
 */
export const ENRICH_MIN_DESCRIPTION_CHARS = 200;

/**
 * Derived fields (summary, requirements, salary range…) the spec asks for and
 * the job lacks, when an extraction could still supply them.
 *
 * Only a job that was never extracted qualifies. One that was has already had
 * its one extraction, and a field still empty after it is simply not in the
 * posting; asking again would put every future pick of that job through a
 * waiting state for nothing.
 *
 * The job also needs a description long enough to extract from. An enrichment
 * reads the saved description and nothing else (it never crawls `url`), and it
 * refuses one under ENRICH_MIN_DESCRIPTION_CHARS. A refusal leaves `extractedAt`
 * null, so without this check a job saved with only a link or a one-line note
 * would sit through the waiting state for a refusal it was always going to get.
 *
 * A job whose description the backend refused for good (a recruiter email, the
 * user's own notes) has had its one extraction too. The backend records that on
 * the job as `extraction.refusal`, cleared when the description changes, so a
 * job read after the refusal carries it. A copy read before does not: "Your
 * jobs" is a cached list that nothing refetches after a failed enrichment, so
 * the caller also passes `refused` (see `isLastingEnrichRefusal` and
 * `enrichRefusalKey`), remembered from an earlier pick of the same text.
 */
export function fieldsNeedingExtraction(job: SavedJobItem, parsed: ParsedFieldSpec, refused = false): JobField[] {
  if (job.extraction.extractedAt !== null || job.extraction.refusal !== null || refused) return [];
  if ((job.description ?? "").trim().length < ENRICH_MIN_DESCRIPTION_CHARS) return [];
  const requested = new Set<JobField>([...parsed.required, ...parsed.optional]);
  return JOB_FIELDS.filter((field) => requested.has(field) && JOB_FIELD_META[field].tier === "derived" && isEmptyValue(job[field]));
}

/**
 * Whether a failed enrichment would fail the same way on the same text.
 * `not-a-posting` is the backend saying the description is not a posting,
 * which no amount of retrying changes. Every other failure (`limited`,
 * `paused`, `timeout`, `provider-error`) passes, so the job stays eligible.
 * Keep it in step with LASTING_ENRICH_REFUSALS in the backend's
 * jobImportService.ts, which records the same refusals on the job.
 */
export function isLastingEnrichRefusal(item: JobImportItem): boolean {
  return item.status === "failed" && item.error?.code === "not-a-posting";
}

/**
 * Names one refused enrichment: the job, and the description the backend read.
 * The text is part of it because the backend keys its extraction on the text,
 * so an edited job is a new question that deserves its own answer.
 */
export function enrichRefusalKey(job: Pick<SavedJobItem, "id" | "description">): string {
  return `${job.id}\n${(job.description ?? "").trim()}`;
}

/**
 * The body of POST /api/saved-jobs for the paste form: the import's whole
 * draft, including fields this screen never showed, overlaid with what the
 * user can see and edit. Blank inputs are sent as null, never as "".
 */
export function saveInputFrom(state: PickerState): SaveJobInput {
  const draft: Partial<JobDraft> = state.draft ? { ...state.draft } : { source: "manual" };
  const writable = draft as Partial<Record<JobField, unknown>>;
  for (const field of INPUT_FIELDS) {
    const value = state.values[field];
    if (value === undefined) continue;
    const trimmed = value.trim();
    writable[field] = trimmed === "" ? null : trimmed;
  }
  const input = {
    draft: { ...draft, company: (state.values.company ?? "").trim(), role: (state.values.role ?? "").trim() },
  };
  return state.importId ? { importId: state.importId, ...input } : input;
}

/** The PATCH body when finishing a saved job: only editable fields the user actually changed. */
export function changesForUpdate(job: SavedJobItem, values: PickerState["values"]): UpdateSavedJobInput {
  const changes: Partial<Record<JobField, string | null>> = {};
  for (const field of EDITABLE_JOB_FIELDS) {
    if (!INPUT_FIELDS.includes(field)) continue;
    const value = values[field];
    if (value === undefined) continue;
    const next = value.trim() === "" ? null : value.trim();
    if (next !== job[field]) changes[field] = next;
  }
  return changes as UpdateSavedJobInput;
}

// ---------------------------------------------------------------------------
// Copy — every failure names what happened and offers a way forward
// ---------------------------------------------------------------------------

export type RecoveryAction = "edit-input" | "paste-text" | "fill-in" | "retry";

export interface Recovery {
  action: RecoveryAction;
  label: string;
}

export interface FailureCopy {
  message: string;
  recoveries: Recovery[];
}

const EDIT_LINK: Recovery = { action: "edit-input", label: "Edit the link" };
const PASTE_TEXT: Recovery = { action: "paste-text", label: "Paste the text instead" };
const FILL_IN: Recovery = { action: "fill-in", label: "Fill it in" };
const RETRY: Recovery = { action: "retry", label: "Try again" };

// Sites known to refuse automated reading, named in the copy because "LinkedIn
// doesn't let us read postings" is something a person can act on and "that
// site" is not. Anything else that blocks us is "That site".
const BLOCKING_SITES: readonly (readonly [domain: string, name: string])[] = [
  ["linkedin.com", "LinkedIn"],
  ["indeed.com", "Indeed"],
  ["glassdoor.com", "Glassdoor"],
];

function siteName(link: string | null): string | null {
  if (!link) return null;
  try {
    const host = new URL(link).hostname.toLowerCase();
    const hit = BLOCKING_SITES.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
    return hit ? hit[1] : null;
  } catch {
    return null;
  }
}

/** "3:40 PM", in the viewer's locale. */
export function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * The plan's B1 table, plus the three codes it predates (`target-unreachable`,
 * `too-long`, and a request that failed before any code existed). The copy is
 * chosen by code here rather than taken from `error.message`, so every failure
 * of a kind reads the same and always comes with its recovery.
 */
export function importFailureCopy(failure: ImportFailure): FailureCopy {
  const link = failure.input === "link";
  const later = failure.retryAt === null ? "later" : `at ${clockTime(failure.retryAt)}`;
  switch (failure.code) {
    case "invalid-url":
      return { message: "That link can't be opened — use the posting's public URL.", recoveries: [EDIT_LINK] };
    case "target-blocked":
      return {
        message: `${siteName(failure.link) ?? "That site"} doesn't let us read postings. Paste the text instead.`,
        recoveries: [PASTE_TEXT],
      };
    case "target-closed":
      return { message: "This posting looks closed.", recoveries: [{ action: "fill-in", label: "Save it anyway" }] };
    case "target-unreachable":
      return { message: "We couldn't open that page. Check the link, or paste the text instead.", recoveries: [EDIT_LINK, PASTE_TEXT] };
    case "not-a-posting":
      return { message: link ? "We couldn't find a job on that page." : "We couldn't find a job in that text.", recoveries: [FILL_IN] };
    case "limited":
      return link
        ? { message: `You've read a lot of links this hour — paste the text, or try again ${later}.`, recoveries: [PASTE_TEXT] }
        : { message: `You've filled a lot of jobs this hour — fill the fields in yourself, or try again ${later}.`, recoveries: [FILL_IN] };
    case "paused":
      return link
        ? { message: "Link reading is paused for today — paste the text instead.", recoveries: [PASTE_TEXT] }
        : { message: "Filling fields is paused for today — fill them in yourself.", recoveries: [FILL_IN] };
    case "timeout":
      return { message: link ? "That page took too long to load." : "That took too long.", recoveries: [RETRY] };
    case "provider-error":
      return { message: link ? "Something went wrong reading that page." : "Something went wrong reading that.", recoveries: [RETRY] };
    case "too-long":
      return {
        message: "That's more than one posting's worth of text — paste just the job.",
        recoveries: [{ action: "edit-input", label: "Edit the text" }],
      };
    case "request-failed":
      return { message: failure.message || "That didn't go through.", recoveries: [RETRY] };
  }
}

/** Why the extra details did not arrive. The dialog always offers the job without them, and another try. */
export function enrichFailureMessage(item: JobImportItem): string {
  if (item.status === "abandoned") return "Stopped before the details came through.";
  const error = item.error;
  switch (error?.code) {
    case "limited": {
      const retryAt = error.retryAfterMs === null ? null : retryTime(item, error.retryAfterMs);
      const later = retryAt === null ? "later" : `at ${clockTime(retryAt)}`;
      return `You've pulled details for a lot of jobs this hour. Try again ${later}, or use this one without them.`;
    }
    case "paused":
      return "Pulling out job details is paused for today. You can use this one without them.";
    case "timeout":
      return "That took too long.";
    default:
      return "We couldn't pull out the extra details this screen uses.";
  }
}
