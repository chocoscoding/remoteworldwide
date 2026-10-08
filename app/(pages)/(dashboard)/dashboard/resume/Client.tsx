"use client";

// Resume creator screen — two layers.
//
// `ResumeClient` loads the user's documents from the library (the AI service,
// through the session proxy). `ResumeWorkspace` mounts once they are in, and is
// the top-level owner of the per-document state (`documents`/`activeDocId`).
// Everything else (header, tabs, the paper preview, the Customize/Content
// forms) lives in `ResumeScreenBody`, which the workspace renders INSIDE a
// `ResumeDesignProvider` keyed by the active document's id.
//
// Why two layers: the workspace's `documents` is editor state, not a view of
// the query. It is seeded from the list ONCE, and from then on the editor is
// ahead of the server by whatever has not autosaved yet — a refetch landing on
// top of it would put older text back under someone's cursor. So the list is
// read once per visit (`gcTime: 0` drops it on the way out, and nothing
// refetches it while the screen is up), and every later change flows the other
// way: the editor saves, the workspace keeps its own copy current.
//
// `activeDocId` starts as null: the screen's default is the LANDING — a
// choice between starting from scratch, importing a resume, or opening one
// that already exists — and the editor only mounts once a document is chosen.
// Three links skip the landing (they arrive from the extension's View / Edit
// links through `/open/…`, and from a job's screen):
//
//   ?doc=<id>     open that resume. Read on its own when it is not among the 50
//                 the list carries; a 404 says so and leaves the landing.
//   ?from=<id>    "Edit a copy" of a My documents file: the copy made from it
//                 before (`sourceDocumentId`), else a new one — see
//                 `editableCopyOf`.
//   ?tailor=<id>  the newest resume, with Tailor aimed at that saved job.
//
// A document link wins over ?tailor: it names the resume, where Tailor would
// only open whichever was saved last. The workspace mounts once whichever of
// these is in play has settled, so it is seeded once, with the resume it opens.
// That link is followed once, on arrival.
//
// From then on the address keeps up with the screen (owner, 2026-10-04: the
// resume creator uses URL query parameters): `?doc=<id>` names the resume
// open, none means the landing, and `?tab=` the editor's tab. Opening or
// switching a resume adds a history entry (`pushState`, so nothing is fetched
// again), a tab only replaces the current one, and the browser's Back and
// Forward, or the sidebar's link, move the screen to whatever the address
// says. `?from=` is spent once followed; `?tailor=` stays for its banner.
//
// Why the provider is keyed like that: `ResumeDesignProvider` (chunk A3a)
// owns its design/section state via an uncontrolled `useReducer` — it has no
// "flush your state up to me" API, and it shouldn't need one. Remounting the
// whole provider subtree on `activeDocId` change is what re-seeds it from the
// INCOMING document's stored `design`/`sections` on every switch. The actual
// save-before-switch (reading the OUTGOING document's live state before that
// remount happens) has to run from a component that calls `useResumeDesign()`
// itself — that's `ResumeScreenBody`, not this component, which is why
// `documents`/`activeDocId` are owned here, but the stash of the outgoing
// document is written one level down, as the editor unmounts. The landing's own create/import
// handlers live HERE instead, because with no document open there's nothing
// to stash first.
import { Suspense, useCallback, useEffect, useRef, useState, type FC, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import JobContextBanner from "@/app/components/dashboard/jobs/JobContextBanner";
import { ResumeDesignProvider } from "@/app/components/dashboard/resume/ResumeDesignContext";
import { createBlankContent, fromStored, importLabel, type ResumeDocument } from "@/app/components/dashboard/resume/resume-document";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { usePlanGate } from "@/app/components/dashboard/billing/UpgradeModal";

/** Refused for the account's plan: the upgrade popup already says so. */
const isPlanRefusal = (error: unknown): boolean => error instanceof BackendError && (error.code === "plan_required" || error.status === 402);
import { backToJobHref, readJobContext } from "@/app/lib/dashboard/contextParams";
import { parseFieldSpec, toPickedJob } from "@/app/lib/jobs/fields";
import type { SavedJobItem } from "@/app/lib/jobs/types";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import {
  createResumeDocument,
  deleteResumeDocument,
  editableCopyOf,
  getResumeDocument,
  importResume,
  listResumeDocuments,
  type StoredResumeDocument,
} from "@/app/lib/resume/api";
import ResumeLanding from "@/app/components/dashboard/resume/ResumeLanding";
import DocumentLoading from "@/app/components/dashboard/ui/DocumentLoading";
import BuildResumeDialog from "@/app/components/dashboard/resume/BuildResumeDialog";
import ResumeScreenBody, { RESUME_JOB_SPEC, type ResumeJob, type TailorPreset } from "@/app/components/dashboard/resume/ResumeScreenBody";
import { useSavedJobQuery } from "@/hooks/queries/useJobQueries";

const RESUME_JOB_SPEC_PARSED = parseFieldSpec(RESUME_JOB_SPEC);

/** A saved job as Tailor's pick, or null when it lacks what Tailor needs (a description). */
function resumeJobFrom(saved: SavedJobItem): ResumeJob | null {
  try {
    return toPickedJob<typeof RESUME_JOB_SPEC>(saved, RESUME_JOB_SPEC_PARSED, saved.extraction.sources);
  } catch {
    return null;
  }
}

const latestDocumentId = (documents: StoredResumeDocument[]): string | null =>
  documents.reduce<StoredResumeDocument | null>((latest, d) => (!latest || d.updatedAt.getTime() > latest.updatedAt.getTime() ? d : latest), null)
    ?.id ?? null;

/** A library id, as `?doc=` carries it. Anything else in the param is ignored rather than sent. */
const OBJECT_ID = /^[a-f\d]{24}$/i;
/** A My documents id, as `?from=` carries it. */
const VAULT_ID = /^[A-Za-z0-9_-]{1,64}$/;

const paramMatching = (value: string | null, pattern: RegExp): string | null => (value && pattern.test(value) ? value : null);

/**
 * The creator's address with `doc` set to the resume open, or cleared for the landing (which has
 * no tab either). `?from=` is spent once followed; every other parameter (`?tailor=` and its
 * job context, `?tab=` while a resume is open) is kept.
 */
function creatorHref(doc: string | null): string {
  const next = new URLSearchParams(window.location.search);
  next.delete("from");
  if (doc) next.set("doc", doc);
  else {
    next.delete("doc");
    next.delete("tab");
  }
  const query = next.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}`;
}

interface ResumeWorkspaceProps {
  initialDocuments: StoredResumeDocument[];
  /** The resume to open instead of the landing — one a link named, or the newest for Tailor. Null for the landing. */
  initialOpenId: string | null;
  /**
   * The library list, once it is in. On the plain landing the workspace mounts
   * before it arrives, so starting a resume never waits on it; when it lands,
   * its documents JOIN the workspace's — any already here keep the editor's
   * copy, so nothing made in the meantime is seeded over.
   */
  libraryDocuments: StoredResumeDocument[] | undefined;
  library: "loading" | "error" | "ready";
  onRetryLibrary: () => void;
  banner: ReactNode;
  tailorPreset: TailorPreset | null;
}

const ResumeWorkspace: FC<ResumeWorkspaceProps> = ({ initialDocuments, initialOpenId, libraryDocuments, library, onRetryLibrary, banner, tailorPreset }) => {
  const [documents, setDocuments] = useState<ResumeDocument[]>(() => initialDocuments.map(fromStored));
  const [activeDocId, setActiveDocId] = useState<string | null>(() =>
    initialOpenId && initialDocuments.some((d) => d.id === initialOpenId) ? initialOpenId : null,
  );
  // Deleted this visit: a list that was already on its way must not bring one back.
  const removed = useRef(new Set<string>());

  useEffect(() => {
    if (!libraryDocuments) return;
    setDocuments((prev) => {
      const here = new Set(prev.map((d) => d.id));
      const joining = libraryDocuments.filter((d) => !here.has(d.id) && !removed.current.has(d.id)).map(fromStored);
      return joining.length > 0 ? [...prev, ...joining] : prev;
    });
  }, [libraryDocuments]);

  const activeDoc = activeDocId !== null ? documents.find((d) => d.id === activeDocId) : undefined;

  // ---- The address keeps up with the screen ----------------------------------------------------
  /** Opens a resume, or the landing for null, and writes it into the address as a new history entry. */
  const openId = useCallback((id: string | null) => {
    setActiveDocId(id);
    window.history.pushState(null, "", creatorHref(id));
  }, []);

  // A link that opened a resume without naming it in `doc` (?from=, ?tailor=) writes it in. Only on
  // arrival in practice: every later opening writes its own address, so this finds nothing to do.
  useEffect(() => {
    const opened = paramMatching(new URLSearchParams(window.location.search).get("doc"), OBJECT_ID);
    if (initialOpenId && activeDocId === initialOpenId && opened !== initialOpenId) window.history.replaceState(null, "", creatorHref(initialOpenId));
  }, [initialOpenId, activeDocId]);

  // The address changed under the screen (the browser's Back or Forward, the sidebar's link to the
  // creator): follow it. A resume this visit doesn't hold (one deleted since) leaves the screen as it is.
  const params = useSearchParams();
  const urlDoc = paramMatching(params.get("doc"), OBJECT_ID);
  const [seenUrlDoc, setSeenUrlDoc] = useState(urlDoc);
  if (urlDoc !== seenUrlDoc) {
    setSeenUrlDoc(urlDoc);
    if (urlDoc === null) {
      if (activeDocId !== null) setActiveDocId(null);
    } else if (urlDoc !== activeDocId && documents.some((d) => d.id === urlDoc)) {
      setActiveDocId(urlDoc);
    }
  }

  // Newest first, as the library lists them — a document just made is the one
  // they are about to work on.
  const open = (doc: ResumeDocument) => {
    setDocuments((prev) => [doc, ...prev]);
    openId(doc.id);
  };

  /**
   * Both landing paths report a refusal here rather than throwing it at the
   * landing, whose only job is to say whether it is busy. A failed create or
   * import leaves the user exactly where they were: no half-made document, and
   * nothing that pretends to be their resume.
   */
  const createBlankFromLanding = async (label: string) => {
    try {
      open(fromStored(await createResumeDocument({ label, content: createBlankContent() })));
    } catch (error) {
      // A plan refusal opens the upgrade popup by itself; a toast on top would say it twice.
      if (!isPlanRefusal(error)) toast.error(apiMessage(error));
    }
  };

  /**
   * "Start from a resume you have" — the file is read and parsed, and the
   * draft that opens is already in the library, on what the file actually said.
   */
  const importFromLanding = async (file: File) => {
    try {
      const imported = await importResume(file);
      open(fromStored(await createResumeDocument({ label: importLabel(imported.fileName || file.name), content: imported.content })));
    } catch (error) {
      if (!isPlanRefusal(error)) toast.error(apiMessage(error));
    }
  };

  // "Build with AI". The builder saved the document already, so it is opened,
  // not created again; the build spent credits, so the balance is refreshed.
  // Building with AI is on Basic and up, so Free sees it locked and gets the
  // upgrade popup instead of a dialog it can't finish.
  const queryClient = useQueryClient();
  const { allows, openUpgrade } = usePlanGate();
  const buildLocked = !allows("basic");
  const [buildOpen, setBuildOpen] = useState(false);
  const startBuild = () =>
    buildLocked
      ? openUpgrade({ kind: "plan", requiredPlan: "basic", message: "Building a resume with AI is on Basic and up." })
      : setBuildOpen(true);
  const openBuilt = (stored: StoredResumeDocument) => {
    open(fromStored(stored));
    void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
  };

  const deleteFromLanding = async (id: string) => {
    try {
      await deleteResumeDocument(id);
      removed.current.add(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  // Called by the autosave for every save that lands — including the one it
  // flushes as the editor unmounts, which is why this lives up here, where
  // something is still mounted to hear it.
  const markSaved = useCallback((id: string, updatedAt: Date) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, updatedAt } : d)));
  }, []);

  if (!activeDoc) {
    return (
      <>
        <ResumeLanding
          library={library}
          onRetry={onRetryLibrary}
          documents={documents}
          onOpen={openId}
          onCreateBlank={createBlankFromLanding}
          onImport={importFromLanding}
          onDelete={deleteFromLanding}
          onBuild={startBuild}
          buildLocked={buildLocked}
          banner={banner}
        />
        <BuildResumeDialog open={buildOpen} onOpenChange={setBuildOpen} onBuilt={openBuilt} />
      </>
    );
  }

  return (
    <ResumeDesignProvider
      key={activeDoc.id}
      initialDesign={activeDoc.design}
      initialSections={activeDoc.sections}
      initialContent={activeDoc.content}
      initialCheck={activeDoc.check}>
      <ResumeScreenBody
        activeDocId={activeDoc.id}
        activeDoc={activeDoc}
        setDocuments={setDocuments}
        onSaved={markSaved}
        banner={banner}
        tailorPreset={tailorPreset}
      />
    </ResumeDesignProvider>
  );
};

const ResumeScreen: FC = () => {
  const params = useSearchParams();
  // The link the page was arrived on decides what opens, once. Later changes to the address are the
  // workspace's own (opening, switching, the browser's Back), not new links to follow: following
  // them here would unmount the editor to look up a resume it already holds.
  const [arrival] = useState(() => {
    const doc = paramMatching(params.get("doc"), OBJECT_ID);
    return { doc, from: doc ? null : paramMatching(params.get("from"), VAULT_ID) };
  });
  const docParam = arrival.doc;
  const fromParam = arrival.from;
  const context = readJobContext(params, "tailor");
  const [contextDismissed, setContextDismissed] = useState(false);
  // A link to a document wins over ?tailor (see the header).
  const tailorId = contextDismissed || docParam || fromParam ? null : context.savedJobId;

  const saved = useSavedJobQuery(tailorId);
  const savedJob = saved.data && saved.data.id === tailorId ? saved.data : null;
  const tailorJob = savedJob ? resumeJobFrom(savedJob) : null;
  const role = context.role ?? savedJob?.role ?? null;
  const company = context.company ?? savedJob?.company ?? null;
  const label = role && company ? `${role} at ${company}` : (role ?? company ?? "this job");

  const tailorPreset: TailorPreset | null =
    tailorId === null
      ? null
      : tailorJob
        ? { status: "ready", label: `${tailorJob.role} at ${tailorJob.company}`, job: tailorJob }
        : savedJob || saved.isError
          ? { status: "failed", label }
          : { status: "loading", label };

  const banner =
    tailorId !== null && (role || company) ? (
      <JobContextBanner
        action="Tailoring"
        role={role}
        company={company}
        backHref={backToJobHref(context)}
        onDismiss={() => setContextDismissed(true)}
      />
    ) : null;

  const library = useQuery({
    queryKey: qk.resumes.list(),
    queryFn: ({ signal }) => listResumeDocuments(signal),
    staleTime: STALE_TIME.resumes,
    // See the header: read once per visit, never refreshed underneath the editor.
    gcTime: 0,
    refetchOnReconnect: false,
  });

  const listed = library.data;

  // ?doc= past the 50 the list carries: read on its own, once.
  const missingId = docParam && listed && !listed.some((d) => d.id === docParam) ? docParam : null;
  const named = useQuery({
    queryKey: qk.resumes.document(missingId ?? ""),
    queryFn: ({ signal }) => getResumeDocument(missingId as string, signal),
    enabled: missingId !== null,
    staleTime: STALE_TIME.resumes,
    gcTime: 0,
    refetchOnReconnect: false,
  });

  // ?from= — "Edit a copy". Not a mutation hook on purpose: it has to run by
  // itself on arrival, exactly once, and a query dedupes the StrictMode double
  // mount that would otherwise create two copies. It never refetches (the key is
  // the file, and the copy it found or made is the answer for this visit), and
  // it never retries: a retry after a create that landed but whose answer was
  // lost would make a second copy.
  const copy = useQuery({
    queryKey: qk.resumes.copyOf(fromParam ?? ""),
    queryFn: () => editableCopyOf(fromParam as string, listed ?? []),
    enabled: fromParam !== null && listed !== undefined,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnReconnect: false,
  });

  // A link that could not be followed says why, once, and leaves the landing.
  const namedError = named.isError ? named.error : null;
  useEffect(() => {
    if (!namedError) return;
    toast.error(
      namedError instanceof BackendError && namedError.status === 404
        ? "That resume couldn't be found. It may have been deleted."
        : apiMessage(namedError),
    );
  }, [namedError]);
  const copyError = copy.isError ? copy.error : null;
  useEffect(() => {
    if (!copyError) return;
    toast.error(
      copyError instanceof BackendError && copyError.status === 404
        ? "That file couldn't be found in My documents. It may have been deleted."
        : apiMessage(copyError),
    );
  }, [copyError]);

  const waitingForNamed = missingId !== null && named.isPending;
  const waitingForCopy = fromParam !== null && copy.isPending;
  // No link naming a resume to open, so nothing here needs the list to decide
  // anything: the workspace mounts at once and the list joins it when it lands.
  const plainLanding = docParam === null && fromParam === null && tailorId === null;

  if ((listed && !waitingForNamed && !waitingForCopy) || plainLanding) {
    // A resume read on its own, or a copy just made, joins the list at the top — it is the one being opened.
    const extra = [named.data, copy.data?.created ? copy.data.document : undefined].filter((d): d is StoredResumeDocument => !!d);
    const base = listed ?? [];
    const initialDocuments = extra.length > 0 ? [...extra, ...base.filter((d) => !extra.some((e) => e.id === d.id))] : base;
    const initialOpenId = docParam ?? copy.data?.document.id ?? (tailorId !== null && listed ? latestDocumentId(listed) : null);
    return (
      <ResumeWorkspace
        initialDocuments={initialDocuments}
        initialOpenId={initialOpenId}
        libraryDocuments={listed}
        library={listed ? "ready" : library.isError ? "error" : "loading"}
        onRetryLibrary={() => void library.refetch()}
        banner={banner}
        tailorPreset={tailorPreset}
      />
    );
  }

  // A link is waiting on the list (or its own read, or the copy) to know which resume it opens: it
  // says so, centred, and never shows the landing it did not ask for (owner, 2026-10-08). Only a list
  // that failed falls back to the landing, which says so and offers to retry.
  if (!library.isError) return <DocumentLoading kind="resume" />;
  return <ResumeLanding library="error" onRetry={() => void library.refetch()} documents={[]} banner={banner} />;
};

const ResumeClient: FC = () => (
  <Suspense fallback={<ResumeLanding library="loading" documents={[]} />}>
    <ResumeScreen />
  </Suspense>
);

export default ResumeClient;
