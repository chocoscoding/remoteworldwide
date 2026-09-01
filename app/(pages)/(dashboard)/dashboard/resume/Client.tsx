"use client";

// Resume creator screen — top-level owner of the per-document state
// (`documents`/`activeDocId`). Everything else (header, tabs, the paper
// preview, the Customize/Content forms) lives in `ResumeScreenBody`, which
// this renders INSIDE a `ResumeDesignProvider` keyed by the active document's
// id.
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
import { useState, type FC } from "react";
import { ResumeDesignProvider } from "@/app/components/dashboard/resume/ResumeDesignContext";
import {
  createBlankContent,
  createImportedDocument,
  INITIAL_DOCUMENTS,
  type ResumeDocument,
} from "@/app/components/dashboard/resume/resume-document";
import { DEFAULT_DESIGN, DEFAULT_SECTIONS } from "@/app/lib/dashboard/resume/design-defaults";
import ResumeLanding from "@/app/components/dashboard/resume/ResumeLanding";
import ResumeScreenBody from "@/app/components/dashboard/resume/ResumeScreenBody";

const ResumeClient: FC = () => {
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  const activeDoc = activeDocId !== null ? documents.find((d) => d.id === activeDocId) : undefined;

  const createBlankFromLanding = (label: string) => {
    const doc: ResumeDocument = {
      id: `res-new-${Date.now()}`,
      label,
      content: createBlankContent(),
      design: DEFAULT_DESIGN,
      sections: DEFAULT_SECTIONS,
      score: 0,
      before: null,
      tailoredAt: null,
      isBlank: true,
    };
    setDocuments((prev) => [...prev, doc]);
    setActiveDocId(doc.id);
  };

  const importFromLanding = (fileName: string) => {
    const doc = createImportedDocument(fileName);
    setDocuments((prev) => [...prev, doc]);
    setActiveDocId(doc.id);
  };

  if (!activeDoc) {
    return <ResumeLanding documents={documents} onOpen={setActiveDocId} onCreateBlank={createBlankFromLanding} onImport={importFromLanding} />;
  }

  return (
    <ResumeDesignProvider key={activeDoc.id} initialDesign={activeDoc.design} initialSections={activeDoc.sections}>
      <ResumeScreenBody
        documents={documents}
        activeDocId={activeDoc.id}
        activeDoc={activeDoc}
        setDocuments={setDocuments}
        setActiveDocId={setActiveDocId}
      />
    </ResumeDesignProvider>
  );
};

export default ResumeClient;
