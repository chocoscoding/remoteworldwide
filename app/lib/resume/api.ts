// Browser-side calls for the resume editor: "start from a resume you have", and
// the library of documents the editor opens, autosaves into and deletes from.
//
// The routes live in the AI service under /api/ai/resume and go through the
// session proxy at `app/api/ai/[...path]/route.ts`, never a rewrite: the proxy
// sets `x-user-id` from the verified session and adds the service token, so the
// browser never says who it is and never holds a secret.
//
// About the import:
//
// The file travels as base64 in a JSON body rather than as multipart. That is
// the transport the AI service takes a resume in — it decodes the bytes and
// parks them in object storage for its worker — and the proxy forwards JSON,
// so this needs no second upload path.
//
// The upload answers with a job, not the resume: the parse happens on the AI
// service's worker, and `./importJob.ts` waits for it.

import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/lib/api/client";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import type { ResumeContent, ResumeDocumentSummary } from "@/app/lib/dashboard/types";
import { getIngestedResume, prepareResumeForDoc } from "@/app/lib/ats/api";
import { waitForImport, type ResumeImportAccepted, type ResumeImportView } from "./importJob";
import { MAX_RESUME_BYTES, RESUME_TYPES_HINT, isReadableMime, mimeForFileName } from "./mime";

// The accepted types, the size ceiling and the copy live in `./mime.ts` so the
// server-side ingest bridge shares them. The ceiling is checked here as well as
// in the service because a refusal after a 9MB upload is a slow way to learn a
// fast fact.
export { MAX_RESUME_BYTES, RESUME_ACCEPT, RESUME_TYPES_HINT } from "./mime";

/**
 * The type to declare for a file.
 *
 * The browser's own `file.type` is empty for `.md` on most platforms and
 * unreliable for `.docx`, so the extension decides and `file.type` is only a
 * fallback. Null means the picker let through something the parser cannot read.
 */
export const resumeMimeType = (file: File): string | null => {
  const byExtension = mimeForFileName(file.name);
  if (byExtension) return byExtension;
  const declared = file.type.split(";")[0].toLowerCase().trim();
  return isReadableMime(declared) ? declared : null;
};

/**
 * Base64 without holding a second copy of the file as a JS string of char
 * codes: `btoa(String.fromCharCode(...bytes))` overflows the call stack well
 * before 7MB. FileReader does the encoding natively; the data URL's
 * `data:<type>;base64,` prefix is cut off.
 */
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("That file could not be read"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      if (comma === -1) {
        reject(new Error("That file could not be read"));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });

export interface ImportedResume {
  resumeId: string;
  version: number;
  status: string;
  fileName: string;
  chunkCount: number;
  /** Parsed from the file's own text — empty fields mean the parser found none. */
  content: ResumeContent;
  /** True when this exact resume was already on file and nothing was re-embedded. */
  duplicate: boolean;
}

const IMPORTS = "/api/ai/resume/imports";

/**
 * Sends a CV to be read and parsed, and resolves once it has been — the upload
 * only queues the parse, and `waitForImport` polls for the result, so a caller
 * awaiting this keeps its spinner up for the whole of it exactly as before.
 * Throws `Error` for a file this side can already tell is wrong, and
 * `BackendError` (with the service's own message) for anything the server
 * refuses — an unreadable PDF, a scan with no text — whether it refused the
 * upload or the parse.
 */
export async function importResume(file: File): Promise<ImportedResume> {
  const mimeType = resumeMimeType(file);
  if (!mimeType) throw new Error(RESUME_TYPES_HINT);
  if (file.size === 0) throw new Error("That file is empty");
  if (file.size > MAX_RESUME_BYTES) throw new Error("That file is larger than 7MB");

  const data = await toBase64(file);
  const { job } = await apiPost<ResumeImportAccepted>(IMPORTS, { fileName: file.name, mimeType, data });
  return waitForImport<ImportedResume>(job, (id) => apiGet<ResumeImportView<ImportedResume>>(`${IMPORTS}/${encodeURIComponent(id)}`));
}

// ---------------------------------------------------------------------------
// A resume that was never a file — the one open in the editor
// ---------------------------------------------------------------------------

/**
 * The editor's content as the plain text a scan can read.
 *
 * A scan names an INGESTED resume — parsed, chunked, embedded — and the editor
 * holds a `ResumeContent` object, not a file, so there is nothing for
 * `/api/ats/resume-for-doc` to fetch. This is the other half of the bridge:
 * render the document the way a CV is laid out and hand the text to the same
 * importer an upload goes through.
 *
 * The layout is not a style choice. It mirrors the fixture the AI service's
 * chunker is tested against (`tests/helpers/fixtures.ts`): upper-case section
 * headings it recognises, "Role — Company" on one line with the dates on the
 * next so every bullet below inherits its role, and skills on one comma line
 * so they are not split word by word. A layout the chunker has never seen
 * would still import, and would then score against evidence with no role
 * attached.
 *
 * Deterministic on purpose: the service dedupes on a hash of the normalized
 * text, so the same document rendered twice lands on the row that already
 * exists and is not embedded again — which is what makes checking an unedited
 * resume a second time cheap, and a re-scan of it free.
 */
export function resumeContentToText(content: ResumeContent): string {
  const lines: string[] = [];
  const push = (...values: Array<string | undefined>) => {
    for (const value of values) if (value !== undefined) lines.push(value);
  };
  const section = (heading: string) => push("", heading);
  const clean = (value: string | undefined) => (value ?? "").trim();

  // The name as the user wrote it, not upper-cased the way a printed CV often
  // is: the ingested content is what the cover letter is written from, and a
  // name round-tripped in capitals comes back as the letter's sign-off.
  push(clean(content.name), clean(content.title));
  const contact = [content.location, content.email, content.phone].map(clean).filter(Boolean);
  if (contact.length > 0) push(contact.join(" · "));
  const links = content.links.map((link) => clean(link.url)).filter(Boolean);
  if (links.length > 0) push(links.join(" · "));

  if (clean(content.summary)) {
    section("SUMMARY");
    push(clean(content.summary));
  }

  // A role hidden in the editor is off the page, so the check reads the resume without it.
  const experience = content.experience.filter(
    (entry) => !entry.hidden && (clean(entry.role) || clean(entry.company) || entry.bullets.some((b) => clean(b))),
  );
  if (experience.length > 0) {
    section("EXPERIENCE");
    for (const entry of experience) {
      push("", [clean(entry.role), clean(entry.company)].filter(Boolean).join(" — "));
      const meta = [clean(entry.dates), clean(entry.location)].filter(Boolean).join(" · ");
      if (meta) push(meta);
      for (const bullet of entry.bullets) if (clean(bullet)) push(`- ${clean(bullet)}`);
    }
  }

  const education = content.education.filter((entry) => clean(entry.school) || clean(entry.degree));
  if (education.length > 0) {
    section("EDUCATION");
    for (const entry of education) {
      push([clean(entry.degree), clean(entry.school)].filter(Boolean).join(", "));
      if (clean(entry.dates)) push(clean(entry.dates));
      if (clean(entry.detail)) push(clean(entry.detail));
    }
  }

  const skills = content.skills.map(clean).filter(Boolean);
  if (skills.length > 0) {
    section("SKILLS");
    push(skills.join(", "));
  }

  const projects = content.projects.filter((entry) => clean(entry.name));
  if (projects.length > 0) {
    section("PROJECTS");
    for (const entry of projects) push([clean(entry.name), clean(entry.detail)].filter(Boolean).join(" — "));
  }

  const certifications = content.certifications.filter((entry) => clean(entry.name));
  if (certifications.length > 0) {
    section("CERTIFICATIONS");
    for (const entry of certifications) {
      const issuer = clean(entry.issuer);
      push(`${clean(entry.name)}${issuer ? ` (${issuer})` : ""}${clean(entry.year) ? `, ${clean(entry.year)}` : ""}`);
    }
  }

  // Custom sections' points, as the AI service's twin writes them: under the name when one was
  // filled in (`withSectionTitles`), else together under one heading.
  const custom = (content.customSections ?? []).filter((entry) => entry.items.some((item) => clean(item)));
  for (const entry of custom.filter((entry) => clean(entry.title))) {
    section(clean(entry.title).toUpperCase());
    for (const point of entry.items.map(clean).filter(Boolean)) push(`- ${point}`);
  }
  const untitled = custom.filter((entry) => !clean(entry.title)).flatMap((entry) => entry.items.map(clean).filter(Boolean));
  if (untitled.length > 0) {
    section("MORE");
    for (const point of untitled) push(`- ${point}`);
  }

  return lines.join("\n").trim();
}

/** The label an ingested row carries. The service caps it at 120 characters. */
const MAX_IMPORT_LABEL = 120;

/**
 * Ingests the editor's content so it can be scored, and answers with its
 * resume id.
 *
 * Every edit is new text and therefore a new ingested row — which is correct,
 * because a scan is a record of what the resume said when it ran, and a row
 * that changed under it would make an old score describe a new document. An
 * unedited document is deduped by the service and costs nothing.
 *
 * The row is labelled with the document's own name, so the screens that list
 * ingested resumes (the cover letter's "written from") name it the way the
 * user does.
 */
export function importResumeContent(content: ResumeContent, label: string): Promise<ImportedResume> {
  return apiPost<ImportedResume>("/api/ai/resume/imports/text", {
    text: resumeContentToText(content),
    label: label.trim().slice(0, MAX_IMPORT_LABEL) || null,
  });
}

// ---------------------------------------------------------------------------
// Draft resumes — one working copy per application
// ---------------------------------------------------------------------------
//
// The apply wizard's tailoring used to file every accepted version as a new
// ingested resume, and they piled up (owner, 2026-10-03). Now an application
// keeps ONE draft that each accepted version updates in place: same resume id,
// its version bumped, so a scan of the new words is a fresh scan. A draft is
// left out of every resume list until the application is tracked, when it is
// kept as the version that was sent. The content is stored as given — not
// re-read from text — so what the preview shows is exactly what was proposed.

const DRAFTS = "/api/ai/resume/drafts";

const draftLabel = (label: string) => label.trim().slice(0, MAX_IMPORT_LABEL) || "Tailored resume";

/** The application's draft, made from the first version it uses. */
export const createDraftResume = (content: ResumeContent, label: string): Promise<ImportedResume> =>
  apiPost<ImportedResume>(DRAFTS, { content, label: draftLabel(label) });

/** A later version, into the same draft. Unchanged words keep its version. */
export const updateDraftResume = (id: string, content: ResumeContent, label?: string): Promise<ImportedResume> =>
  apiPatch<ImportedResume>(`${DRAFTS}/${encodeURIComponent(id)}`, { content, ...(label ? { label: draftLabel(label) } : {}) });

/** The application was tracked with this draft: kept, under the name it was sent with, in the resume lists from now on. */
export const keepDraftResume = (id: string, label?: string): Promise<ImportedResume> =>
  apiPost<ImportedResume>(`${DRAFTS}/${encodeURIComponent(id)}/keep`, label ? { label: draftLabel(label) } : {});

// ---------------------------------------------------------------------------
// Documents — the library the editor works on
// ---------------------------------------------------------------------------

const DOCUMENTS = "/api/ai/resume/documents";

/**
 * A resume as the service stores it. `design` and `sections` are what was
 * saved, not yet what the editor runs on: a patch over a template (or over the
 * default look), and rows that may or may not carry ids. `hydrate-design.ts`
 * turns them into a `ResumeDesign` and `SectionConfig[]`; nothing else should
 * read them. `null` means never customised.
 */
export interface StoredResumeDocument {
  id: string;
  label: string;
  content: ResumeContent;
  template: string | null;
  design: unknown;
  sections: unknown;
  jobId: string | null;
  /** The My documents file this is an editable copy of ("Edit a copy"). Absent on rows saved before copies existed. */
  sourceDocumentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What a save answers with: proof it landed, and when. */
export interface SavedResumeDocument {
  id: string;
  label: string;
  updatedAt: Date;
}

/** The slices an autosave may send. It sends the ones that changed, whole. */
export interface ResumeDocumentPatch {
  label?: string;
  content?: ResumeContent;
  design?: ResumeDesign;
  sections?: SectionConfig[];
}

/**
 * Saves still on the wire. A list read waits for them, which closes the one
 * race that can lose work inside a single tab: leave the editor with a save in
 * flight, come straight back, and a list that raced that save would seed the
 * editor with the text from before it — which the next autosave would then
 * write back over the newer one.
 */
const inFlight = new Set<Promise<unknown>>();

const tracked = <T,>(promise: Promise<T>): Promise<T> => {
  inFlight.add(promise);
  const done = () => void inFlight.delete(promise);
  promise.then(done, done);
  return promise;
};

/** Every resume this user has, whole, most recently saved first. */
export async function listResumeDocuments(signal?: AbortSignal): Promise<StoredResumeDocument[]> {
  await Promise.allSettled([...inFlight]);
  return apiGet<StoredResumeDocument[]>(DOCUMENTS, signal);
}

/**
 * One resume by id. The list stops at the 50 most recently saved, so a link to
 * an older one (`/dashboard/resume?doc=`) reads it on its own. Another user's
 * id, or a cover letter's, is a 404.
 */
export const getResumeDocument = (id: string, signal?: AbortSignal): Promise<StoredResumeDocument> =>
  apiGet<StoredResumeDocument>(`${DOCUMENTS}/${encodeURIComponent(id)}`, signal);

/**
 * `design` and `sections` are left out on purpose: a new resume starts at the
 * default look, which is stored as nothing. `sourceDocumentId` marks a copy of a
 * My documents file, so the next "Edit a copy" of that file reopens this one.
 */
export const createResumeDocument = (input: { label: string; content: ResumeContent; sourceDocumentId?: string }): Promise<StoredResumeDocument> =>
  tracked(apiPost<StoredResumeDocument>(DOCUMENTS, input));

/** A copy made, or the one made last time. */
export interface EditableCopy {
  document: StoredResumeDocument;
  created: boolean;
}

/**
 * "Edit a copy" of an uploaded file: the library resume made from it before, or
 * a new one.
 *
 * A file cannot be edited — it is bytes in storage — but what it SAYS can be:
 * `/api/ats/resume-for-doc` imports it (free, and deduped: a file already
 * parsed is answered from its link), the parsed content is read back, and it
 * becomes a library resume that remembers where it came from. The earlier copy
 * is found in `library` — the list the editor was seeded with — so clicking
 * "Edit a copy" twice opens one resume, not two.
 */
export async function editableCopyOf(vaultId: string, library: readonly StoredResumeDocument[]): Promise<EditableCopy> {
  const existing = library.find((doc) => doc.sourceDocumentId === vaultId);
  if (existing) return { document: existing, created: false };

  const prepared = await prepareResumeForDoc(vaultId);
  const parsed = await getIngestedResume(prepared.resumeId);
  if (!parsed.content) throw new Error("We couldn't read that file's contents, so there is nothing to edit. Try importing it from the resume screen.");
  const label = `${importLabel(prepared.fileName || parsed.fileName)} (copy)`;
  const document = await createResumeDocument({ label, content: parsed.content, sourceDocumentId: vaultId });
  return { document, created: true };
}

/** The name an imported file's resume starts with: the file's name, read as words. Shared with the editor's own import. */
export const importLabel = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 80) || "Imported resume";

// ---------------------------------------------------------------------------
// Build with AI
// ---------------------------------------------------------------------------

/** What one build costs. Mirrors BUILD_CREDITS in the AI service's resume builder. */
export const BUILD_CREDITS = 3;

export interface BuildResumeInput {
  targetRole: string;
  seniority?: string | null;
  /** A posting to aim the resume at — a saved job's description. */
  jdText?: string | null;
  /** That saved job's id, kept on the document. */
  jobId?: string | null;
  /** An INGESTED resume to rewrite from (a row of `GET /api/ai/resume`), not a library document. */
  fromResumeId?: string | null;
  /** Or a resume made here (a library document) to rewrite from. One source, never both. */
  fromDocumentId?: string | null;
  /** Omitted: the builder picks one. */
  template?: string | null;
  /**
   * Pay with the streak's resume rewrite gift instead of credits and the plan: the AI service takes
   * the gift before it builds and gives it back if the build fails.
   */
  gift?: "rewrite" | null;
}

/** The builder's answer, as far as this app reads it: the library document it saved, and why it built it that way. */
export interface BuiltResume {
  label: string;
  rationale: string;
  /** Already in the library — open it rather than creating another. Null only if saving failed after a paid build. */
  document: StoredResumeDocument | null;
  /** True when a rewrite gift paid for it. */
  gift?: boolean;
}

/**
 * Builds a resume from the user's profile or an imported resume, optionally
 * aimed at a posting, for `BUILD_CREDITS`. The AI service saves it to the
 * library itself, so this is tracked like the other writes: a list fetched
 * straight after sees it.
 */
export const buildResume = (input: BuildResumeInput) =>
  tracked(
    apiPost<BuiltResume>("/api/ai/build", {
      targetRole: input.targetRole,
      seniority: input.seniority || undefined,
      jdText: input.jdText || undefined,
      jobId: input.jobId || undefined,
      fromResumeId: input.fromResumeId || undefined,
      fromDocumentId: input.fromDocumentId || undefined,
      template: input.template || undefined,
      gift: input.gift || undefined,
    }),
  );

/** The browser's keepalive quota is 64KB across every such request in flight; this leaves room for a second one. */
const KEEPALIVE_MAX_BYTES = 48_000;

/**
 * `keepalive` is for the save fired as the page goes away, and it is a request,
 * not a promise: the browser rejects a keepalive fetch whose body is past its
 * quota, so a long resume is sent as an ordinary save instead — which still
 * lands on a document switch or a route change, and is only at risk when the
 * tab itself is closing. Losing that one save beats failing it for certain.
 */
export const saveResumeDocument = (id: string, patch: ResumeDocumentPatch, options: { keepalive?: boolean } = {}): Promise<SavedResumeDocument> => {
  const keepalive = options.keepalive === true && new Blob([JSON.stringify(patch)]).size <= KEEPALIVE_MAX_BYTES;
  return tracked(apiPatch<SavedResumeDocument>(`${DOCUMENTS}/${id}`, patch, { keepalive }));
};

export const deleteResumeDocument = (id: string): Promise<{ id: string }> => tracked(apiDelete<{ id: string }>(`${DOCUMENTS}/${id}`));

/**
 * Every resume made here, archived ones included, without their content — My
 * documents' list of them. The editor's own list (`listResumeDocuments`) leaves
 * archived ones out, as do the extension's pickers.
 */
export const listResumeSummaries = (signal?: AbortSignal): Promise<ResumeDocumentSummary[]> =>
  apiGet<ResumeDocumentSummary[]>(`${DOCUMENTS}?view=summary&archived=include`, signal);

/** Archive (true) or restore (false) a resume from My documents. Not an edit: it keeps its place in "most recent". */
export const setResumeArchived = (id: string, archived: boolean): Promise<SavedResumeDocument> =>
  tracked(apiPatch<SavedResumeDocument>(`${DOCUMENTS}/${encodeURIComponent(id)}`, { archived }));
