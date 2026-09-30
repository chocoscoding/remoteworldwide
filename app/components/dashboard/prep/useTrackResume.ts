"use client";

// The resume a prep track stands on, and the writes that change it. Read by
// the Overview's "Resume you submitted" box and its picker, and by the setup
// screen's gate. The rules themselves are pure, in app/lib/prep/trackResume.ts;
// this is where they meet the two stores:
//  - My documents (`useDocuments`): the files, the master among them, and the
//    one upload path — nothing here uploads any other way.
//  - The AI service's parsed resumes (`useIngestedResumesQuery`): the ids a
//    track stores, and the names to show for them.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDocuments } from "@/app/components/dashboard/documents/DocumentsProvider";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { prepareResumeForDoc } from "@/app/lib/ats/api";
import type { VaultDoc } from "@/app/lib/dashboard/types";
import {
  defaultResumeLabel,
  documentFor,
  hasAnyResume,
  linkedParseOf,
  parsedResumeIdOf,
  resumeChoices,
  resumeGate,
  resumeInEffect,
  type ResumeChoices,
  type ResumeGate,
  type TrackResumeSource,
} from "@/app/lib/prep/trackResume";
import type { PrepTrackItem } from "@/app/lib/prep/types";
import { qk } from "@/app/lib/query/keys";
import { MAX_RESUME_BYTES, RESUME_TYPES_HINT, mimeForFileName } from "@/app/lib/resume/mime";
import { useUpdatePrepTrack } from "@/hooks/mutations/usePrepTrackMutations";
import { useIngestedResumeQuery, useIngestedResumesQuery } from "@/hooks/queries/useAtsQueries";

/** What a pick names: a document to parse, a resume already parsed, or back to the default. */
export type ResumeTarget = { kind: "document"; documentId: string } | { kind: "parsed"; resumeId: string } | { kind: "default" };

/** After an upload: make it this track's resume, or leave the track on its default (which a first upload becomes, as the master). */
export type AfterUpload = "choose" | "default";

export interface TrackResume {
  source: TrackResumeSource;
  /** What to call the resume in effect. Null when there is none, or while its name is still being read. */
  name: string | null;
  /** The name is still being read. False once it is known, missing, or cannot be read right now. */
  naming: boolean;
  /** The resume in effect is the master document, or that document's own parse. */
  isMaster: boolean;
  /** The parsed resume the track names is not on file (deleted, never parsed, or not this user's): the AI service reads it as none. */
  missing: boolean;
  /** What going back to the default would mean; null when there is no default. */
  defaultLabel: string | null;
  gate: ResumeGate;
  choices: ResumeChoices;
  /** The picker row that is in effect, if the picker lists it. */
  selected: Exclude<ResumeTarget, { kind: "default" }> | null;
  /** The write in flight, so its row can say so. */
  busy: ResumeTarget | "upload" | null;
  error: string | null;
  /** Resolves true once the track stores the pick. */
  choose: (target: ResumeTarget) => Promise<boolean>;
  /** A master document default parsed and stored on the track, once; true when a parsed resume is in effect. */
  storeDefault: () => Promise<boolean>;
  upload: (file: File, then: AfterUpload) => Promise<boolean>;
  clearError: () => void;
}

const NONE: TrackResumeSource = { kind: "none" };

const isNotFound = (error: unknown) => error instanceof BackendError && error.status === 404;

/** `item` is absent for a stand-in track with no saved track behind it; everything then reads as none, and every write is a no-op. */
export function useTrackResume(item: PrepTrackItem | undefined): TrackResume {
  const queryClient = useQueryClient();
  const { docs, loading: docsLoading, addUploads } = useDocuments();
  const ingested = useIngestedResumesQuery();
  const { mutateAsync: patchTrack } = useUpdatePrepTrack();
  const [busy, setBusy] = useState<TrackResume["busy"]>(null);
  const [error, setError] = useState<string | null>(null);

  const source = item ? resumeInEffect(item) : NONE;
  const namedId = parsedResumeIdOf(source);
  const rows = ingested.data ?? null;
  const listed = namedId && rows ? (rows.find((row) => row.resumeId === namedId) ?? null) : null;
  // The list is the service's newest fifty, so an older resume can be missing
  // from it. One read by id settles that; the service scopes it to the user,
  // so an id that is not theirs reads as not found, never as a stranger's name.
  const single = useIngestedResumeQuery(namedId && rows && !listed ? namedId : null);
  const found = listed ?? single.data ?? null;
  const missing = namedId !== null && (found ? found.status !== "ready" : isNotFound(single.error));
  const naming = namedId !== null && !found && !ingested.isError && !single.isError;

  const matched = found ? documentFor(found, docs) : null;
  const name = source.kind === "master" ? source.name : found ? (matched?.name ?? found.fileName) : null;
  const isMaster = source.kind === "master" || Boolean(matched?.master);
  // Nothing reads as selected while the named resume is gone: picking its
  // document again must parse it again, not close the picker as a no-op.
  const selected: TrackResume["selected"] = missing
    ? null
    : source.kind === "master"
      ? { kind: "document", documentId: source.documentId }
      : matched && !matched.archived
        ? { kind: "document", documentId: matched.id }
        : namedId
          ? { kind: "parsed", resumeId: namedId }
          : null;

  // A failed read of the parsed list leaves the documents to decide, rather than holding the gate shut.
  const anyResume = hasAnyResume(docsLoading ? null : docs, ingested.isError ? [] : rows);
  const gate = resumeGate(source, { anyResume, namedMissing: missing });
  const choices = resumeChoices(docs, rows ?? []);

  async function choose(target: ResumeTarget): Promise<boolean> {
    if (!item || busy) return false;
    setBusy(target);
    setError(null);
    try {
      let resumeId: string | null = null;
      if (target.kind === "document") {
        // A document already linked to a ready parse (My documents records
        // the link the first time a document is parsed) is stored as it is:
        // no round trip. Otherwise it's parsed here, once, from the document's
        // own bytes, through the same server-side bridge the ATS scorer uses,
        // which also writes the link for next time. Never matched by filename:
        // two different CVs can share a name, and this pick is kept.
        resumeId = linkedParseOf(docs.find((doc) => doc.id === target.documentId), rows ?? []);
        if (!resumeId) {
          resumeId = (await prepareResumeForDoc(target.documentId)).resumeId;
          // A document parsed for the first time is a new row, and the name
          // shown for the track is read from this list: refreshed before the
          // track names it, so the name is there when the pick lands.
          await queryClient.invalidateQueries({ queryKey: qk.ats.ingested() });
        }
      } else if (target.kind === "parsed") {
        resumeId = target.resumeId;
      }
      await patchTrack({ id: item.id, input: { resumeId } });
      return true;
    } catch (reason) {
      setError(apiMessage(reason));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function storeDefault(): Promise<boolean> {
    if (source.kind === "master") return choose({ kind: "document", documentId: source.documentId });
    return parsedResumeIdOf(source) !== null;
  }

  async function upload(file: File, then: AfterUpload): Promise<boolean> {
    if (!item || busy) return false;
    // Checked before the upload rather than when it is parsed: a file the
    // parser cannot read would otherwise sit in My documents as a resume and
    // fail the moment it was picked.
    if (!mimeForFileName(file.name)) {
      setError(`${RESUME_TYPES_HINT} — this one can't be read.`);
      return false;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError("That file is larger than 7MB.");
      return false;
    }
    setBusy("upload");
    setError(null);
    let doc: VaultDoc | undefined;
    try {
      // My documents' own upload: the file lands there like any other, and its
      // toast (or its refusal) is the one every upload shows.
      [doc] = await addUploads([file], { kind: "resume" });
      if (doc?.master && then === "default") {
        // Someone's first resume becomes their master, which is every track's
        // default; the tracks list works defaults out, so it is read again.
        await queryClient.invalidateQueries({ queryKey: qk.prep.tracks() });
      }
    } finally {
      setBusy(null);
    }
    if (!doc) return false;
    if (doc.master && then === "default") return true;
    return choose({ kind: "document", documentId: doc.id });
  }

  return {
    source,
    name,
    naming,
    isMaster,
    missing,
    defaultLabel: defaultResumeLabel(item?.defaultResume ?? null),
    gate,
    choices,
    selected,
    busy,
    error,
    choose,
    storeDefault,
    upload,
    clearError: () => setError(null),
  };
}
