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
//
// Why the provider is keyed like that: `ResumeDesignProvider` (chunk A3a)
// owns its design/section state via an uncontrolled `useReducer` — it has no
// "flush your state up to me" API, and it shouldn't need one. Remounting the
// whole provider subtree on `activeDocId` change is what re-seeds it from the
// INCOMING document's stored `design`/`sections` on every switch. The actual
// save-before-switch (reading the OUTGOING document's live state before that
// remount happens) has to run from a component that calls `useResumeDesign()`
// itself — that's `ResumeScreenBody`, not this component, which is why
// `documents`/`activeDocId` are owned here but the switch/create/back
// HANDLERS are implemented one level down. The landing's own create/import
// handlers live HERE instead, because with no document open there's nothing
// to stash first.
import { Suspense, useCallback, useState, type FC, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import JobContextBanner from "@/app/components/dashboard/jobs/JobContextBanner";
import { ResumeDesignProvider } from "@/app/components/dashboard/resume/ResumeDesignContext";
import { createBlankContent, fromStored, importLabel, type ResumeDocument } from "@/app/components/dashboard/resume/resume-document";
import { apiMessage } from "@/app/lib/api/core";
import { backToJobHref, readJobContext } from "@/app/lib/dashboard/contextParams";
import { parseFieldSpec, toPickedJob } from "@/app/lib/jobs/fields";
import type { SavedJobItem } from "@/app/lib/jobs/types";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import {
  createResumeDocument,
  deleteResumeDocument,
  importResume,
  listResumeDocuments,
  type StoredResumeDocument,
} from "@/app/lib/resume/api";
import ResumeLanding from "@/app/components/dashboard/resume/ResumeLanding";
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

interface ResumeWorkspaceProps {
  initialDocuments: StoredResumeDocument[];
  /** Open the most recently saved resume instead of the landing. */
  openLatest: boolean;
  banner: ReactNode;
  tailorPreset: TailorPreset | null;
}

const ResumeWorkspace: FC<ResumeWorkspaceProps> = ({ initialDocuments, openLatest, banner, tailorPreset }) => {
  const [documents, setDocuments] = useState<ResumeDocument[]>(() => initialDocuments.map(fromStored));
  const [activeDocId, setActiveDocId] = useState<string | null>(() => (openLatest ? latestDocumentId(initialDocuments) : null));

  const activeDoc = activeDocId !== null ? documents.find((d) => d.id === activeDocId) : undefined;

  // Newest first, as the library lists them — a document just made is the one
  // they are about to work on.
  const open = (doc: ResumeDocument) => {
    setDocuments((prev) => [doc, ...prev]);
    setActiveDocId(doc.id);
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
      toast.error(apiMessage(error));
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
      toast.error(apiMessage(error));
    }
  };

  // "Build with AI". The builder saved the document already, so it is opened,
  // not created again; the build spent credits, so the balance is refreshed.
  const queryClient = useQueryClient();
  const [buildOpen, setBuildOpen] = useState(false);
  const openBuilt = (stored: StoredResumeDocument) => {
    open(fromStored(stored));
    void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
  };

  const deleteFromLanding = async (id: string) => {
    try {
      await deleteResumeDocument(id);
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
          library="ready"
          documents={documents}
          onOpen={setActiveDocId}
          onCreateBlank={createBlankFromLanding}
          onImport={importFromLanding}
          onDelete={deleteFromLanding}
          onBuild={() => setBuildOpen(true)}
          banner={banner}
        />
        <BuildResumeDialog open={buildOpen} onOpenChange={setBuildOpen} onBuilt={openBuilt} />
      </>
    );
  }

  return (
    <ResumeDesignProvider key={activeDoc.id} initialDesign={activeDoc.design} initialSections={activeDoc.sections}>
      <ResumeScreenBody
        documents={documents}
        activeDocId={activeDoc.id}
        activeDoc={activeDoc}
        setDocuments={setDocuments}
        setActiveDocId={setActiveDocId}
        onSaved={markSaved}
        banner={banner}
        tailorPreset={tailorPreset}
      />
    </ResumeDesignProvider>
  );
};

const ResumeScreen: FC = () => {
  const params = useSearchParams();
  const context = readJobContext(params, "tailor");
  const [contextDismissed, setContextDismissed] = useState(false);
  const tailorId = contextDismissed ? null : context.savedJobId;

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

  if (library.data)
    return <ResumeWorkspace initialDocuments={library.data} openLatest={tailorId !== null} banner={banner} tailorPreset={tailorPreset} />;

  // Not loaded: the landing, saying so, with its two ways to start held back.
  // A resume created before the list arrives would be seeded over when it did.
  return (
    <ResumeLanding library={library.isError ? "error" : "loading"} onRetry={() => void library.refetch()} documents={[]} banner={banner} />
  );
};

const ResumeClient: FC = () => (
  <Suspense fallback={<ResumeLanding library="loading" documents={[]} />}>
    <ResumeScreen />
  </Suspense>
);

export default ResumeClient;
