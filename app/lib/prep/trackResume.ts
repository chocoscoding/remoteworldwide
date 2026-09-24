// "The resume you submitted": which resume a prep track stands on, as the
// Overview box, the picker and the setup gate read it.
//
// Two stores hold resumes, and a track can name either kind of thing:
//  - My documents (the backend) holds FILES. The master document is the
//    default for a track with nothing better.
//  - The AI service's `ai_resumes` holds PARSED resumes, and a track stores
//    one of those ids (`PrepTrackItem.resumeId`) — the kind of id an
//    application records as the resume it was sent with. Likely questions are
//    written from it.
// A file becomes a parsed resume once, through `/api/ats/resume-for-doc`, and
// the answer is stored on the track so it is never parsed again for it.
//
// Pure: no React, no fetching, and type-only imports, so
// remoteworldwideai/tests/contracts/frontend-track-resume.test.ts can compile
// and run it as it is.

import type { IngestedResume } from "@/app/lib/ats/types";
import type { VaultDoc } from "@/app/lib/dashboard/types";
import type { PrepTrackItem } from "./types";

/** Where the resume in effect comes from, in the order it wins. */
export type TrackResumeSource =
  /** Picked for this track and stored on it. */
  | { kind: "own"; resumeId: string }
  /** The default: the resume the linked tracker application was sent with. */
  | { kind: "application"; resumeId: string }
  /** The default: the master document — a file, parsed onto the track before a session. */
  | { kind: "master"; documentId: string; name: string }
  | { kind: "none" };

export function resumeInEffect(item: Pick<PrepTrackItem, "resumeId" | "defaultResume">): TrackResumeSource {
  if (item.resumeId) return { kind: "own", resumeId: item.resumeId };
  const fallback = item.defaultResume;
  if (fallback?.source === "application") return { kind: "application", resumeId: fallback.resumeId };
  if (fallback?.source === "master") return { kind: "master", documentId: fallback.documentId, name: fallback.name };
  return { kind: "none" };
}

/** The parsed-resume id in effect, when there is one: what the AI service reads for this track. */
export function parsedResumeIdOf(source: TrackResumeSource): string | null {
  return source.kind === "own" || source.kind === "application" ? source.resumeId : null;
}

/**
 * Whether a session may start without setup's resume step: the track already
 * names a parsed resume. A master document still has to be parsed onto the
 * track, which setup does as it starts, so the live screen sends that case
 * back to setup rather than running without it.
 */
export function sessionResumeReady(item: Pick<PrepTrackItem, "resumeId" | "defaultResume">): boolean {
  return parsedResumeIdOf(resumeInEffect(item)) !== null;
}

/** The label under the name, so it is always plain whose choice this is. */
export const SOURCE_LABELS: Record<Exclude<TrackResumeSource["kind"], "none">, string> = {
  own: "Chosen for this track",
  application: "From your application",
  master: "Default — your master resume",
};

/** What going back to the default would mean, for the picker's "Use the default" row. Null when there is no default. */
export function defaultResumeLabel(fallback: PrepTrackItem["defaultResume"]): string | null {
  if (fallback?.source === "application") return "The resume your application was sent with";
  if (fallback?.source === "master") return `Your master resume, ${fallback.name}`;
  return null;
}

// ---------------------------------------------------------------------------
// The two lists, reconciled
// ---------------------------------------------------------------------------

/**
 * The filename a vault document was stored under, which is what the importer
 * records on the parsed row. Restated from `fileNameOf` in app/lib/ats/api.ts
 * to keep this module free of runtime imports.
 */
const storedFileName = (doc: Pick<VaultDoc, "name" | "ext">): string => (doc.ext ? `${doc.name}.${doc.ext}` : doc.name);

/**
 * Parsed resumes listed beside the documents: the apply wizard's uploads and
 * its tailored copies, and resumes checked from the editor, which were never
 * files in My documents. Capped, newest first — they pile up, and past a
 * handful the picker is a log rather than a choice.
 */
export const PARSED_CHOICES_MAX = 8;

export interface ResumeChoices {
  /** Live resumes in My documents, the master first, then newest first. */
  documents: VaultDoc[];
  /** Ready parsed resumes that are not a document above, newest first (the service's order). */
  parsed: IngestedResume[];
}

/**
 * Whether a parsed row is this resume document's own parse. The document's
 * stored link (`aiResumeId`, written once the document is first parsed) is
 * exact and decides whenever the document has one. Only a document not yet
 * linked falls back to the filename, the one thing the two stores otherwise
 * share — which can be wrong, since two different CVs can both be "Resume.pdf".
 */
const isParseOf = (row: Pick<IngestedResume, "resumeId" | "fileName">, doc: VaultDoc): boolean =>
  doc.aiResumeId ? Boolean(row.resumeId) && doc.aiResumeId === row.resumeId : storedFileName(doc).toLowerCase() === row.fileName.toLowerCase();

/**
 * What the picker offers, with nothing twice. A parsed row that is a resume
 * document's own parse — live or archived — is shown as the document (or,
 * archived, not at all: archiving hides a file from pickers). A filename match
 * on an unlinked document can still wrongly hide a row, but never picks wrongly:
 * picking a document resolves that document's own parse, not the match.
 * Rows that never parsed are left out: the AI service would read them as no
 * resume.
 */
export function resumeChoices(docs: readonly VaultDoc[], ingested: readonly IngestedResume[]): ResumeChoices {
  const resumes = docs.filter((doc) => doc.kind === "resume");
  const documents = resumes
    .filter((doc) => !doc.archived)
    .sort((a, b) => Number(Boolean(b.master)) - Number(Boolean(a.master)) || b.addedAt - a.addedAt);
  const parsed = ingested
    .filter((row) => row.status === "ready" && !resumes.some((doc) => isParseOf(row, doc)))
    .slice(0, PARSED_CHOICES_MAX);
  return { documents, parsed };
}

/** Whether there is any resume at all to prep on, in either store. Null while that cannot be told yet. */
export function hasAnyResume(docs: readonly VaultDoc[] | null, ingested: readonly IngestedResume[] | null): boolean | null {
  if (docs?.some((doc) => doc.kind === "resume" && !doc.archived)) return true;
  if (ingested?.some((row) => row.status === "ready")) return true;
  return docs === null || ingested === null ? null : false;
}

/**
 * The document a parsed row came from: the one linked to it, else — for a
 * document not yet linked — the one stored under its filename. A linked
 * document is never matched by name, so a same-named CV can't borrow its badge.
 */
export function documentFor(row: Pick<IngestedResume, "resumeId" | "fileName">, docs: readonly VaultDoc[]): VaultDoc | null {
  const resumes = docs.filter((doc) => doc.kind === "resume");
  // Both sides must name an id: an absent link on each would otherwise "match" (undefined === undefined).
  const linked = row.resumeId ? resumes.find((doc) => doc.aiResumeId === row.resumeId) : undefined;
  return linked ?? resumes.find((doc) => !doc.aiResumeId && isParseOf(row, doc)) ?? null;
}

/**
 * The parse a document is already linked to, when that parse is still ready —
 * so a pick needs no round trip at all. Null means ask the bridge, which parses
 * the document (once) and writes the link for next time.
 */
export function linkedParseOf(doc: Pick<VaultDoc, "aiResumeId"> | undefined, ingested: readonly IngestedResume[]): string | null {
  const id = doc?.aiResumeId;
  if (!id) return null;
  return ingested.some((row) => row.resumeId === id && row.status === "ready") ? id : null;
}

// ---------------------------------------------------------------------------
// The setup gate
// ---------------------------------------------------------------------------

/**
 * Whether a session on this track may start, and what stands in the way:
 *  - `ready`: a parsed resume is in effect.
 *  - `store-master`: the master document is the default; setup parses it and
 *    stores it on the track as it starts, once.
 *  - `pick`: there are resumes, but none is in effect — or the one named has
 *    since gone (deleted, or never parsed) — so the user says which they sent.
 *  - `upload`: there is no resume anywhere. The first one uploaded becomes the
 *    master, which makes it the default.
 *  - `checking`: the lists that decide between the last two have not landed.
 */
export type ResumeGate = "ready" | "store-master" | "pick" | "upload" | "checking";

export function resumeGate(source: TrackResumeSource, facts: { anyResume: boolean | null; namedMissing: boolean }): ResumeGate {
  if (source.kind === "master") return "store-master";
  if ((source.kind === "own" || source.kind === "application") && !facts.namedMissing) return "ready";
  if (facts.anyResume === null) return "checking";
  return facts.anyResume ? "pick" : "upload";
}
