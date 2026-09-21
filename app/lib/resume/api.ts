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
// the transport the AI service already uses for a resume — its ingest queue
// carries the same bytes the same way — and the proxy forwards JSON, so this
// needs no second upload path.

import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/lib/api/client";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
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

/**
 * Sends a CV to be read and parsed. Throws `Error` for a file this side can
 * already tell is wrong, and `BackendError` (with the service's own message)
 * for anything the server refuses — an unreadable PDF, a scan with no text.
 */
export async function importResume(file: File): Promise<ImportedResume> {
  const mimeType = resumeMimeType(file);
  if (!mimeType) throw new Error(RESUME_TYPES_HINT);
  if (file.size === 0) throw new Error("That file is empty");
  if (file.size > MAX_RESUME_BYTES) throw new Error("That file is larger than 7MB");

  const data = await toBase64(file);
  return apiPost<ImportedResume>("/api/ai/resume/imports", { fileName: file.name, mimeType, data });
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

  const experience = content.experience.filter((entry) => clean(entry.role) || clean(entry.company) || entry.bullets.some((b) => clean(b)));
  if (experience.length > 0) {
    section("EXPERIENCE");
    for (const entry of experience) {
      push("", [clean(entry.role), clean(entry.company)].filter(Boolean).join(" — "));
      if (clean(entry.dates)) push(clean(entry.dates));
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

/** `design` and `sections` are left out on purpose: a new resume starts at the default look, which is stored as nothing. */
export const createResumeDocument = (input: { label: string; content: ResumeContent }): Promise<StoredResumeDocument> =>
  tracked(apiPost<StoredResumeDocument>(DOCUMENTS, input));

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
