"use client";

// Resume creator screen — top-level owner of the per-document state
// (`documents`/`activeDocId`). Everything else (header, tabs, the paper
// preview, the Customize/Content forms) lives in `ResumeScreenBody`, which
// this renders INSIDE a `ResumeDesignProvider` keyed by the active document's
// id.
//
// Why keyed like that: `ResumeDesignProvider` (chunk A3a) owns its
// design/section state via an uncontrolled `useReducer` — it has no "flush
// your state up to me" API, and it shouldn't need one. Remounting the whole
// provider subtree on `activeDocId` change is what re-seeds it from the
// INCOMING document's stored `design`/`sections` on every switch. The actual
// save-before-switch (reading the OUTGOING document's live state before that
// remount happens) has to run from a component that calls `useResumeDesign()`
// itself — that's `ResumeScreenBody`, not this component, which is why
// `documents`/`activeDocId` are owned here but the switch/create HANDLERS are
// implemented one level down.
import { useState, type FC } from "react";
import { ResumeDesignProvider } from "@/app/components/dashboard/resume/ResumeDesignContext";
import { INITIAL_DOCUMENTS } from "./_components/resume-document";
import ResumeScreenBody from "./_components/ResumeScreenBody";

const ResumeClient: FC = () => {
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [activeDocId, setActiveDocId] = useState(INITIAL_DOCUMENTS[0].id);

  const activeDoc = documents.find((d) => d.id === activeDocId) ?? documents[0];

  return (
    <ResumeDesignProvider key={activeDocId} initialDesign={activeDoc.design} initialSections={activeDoc.sections}>
      <ResumeScreenBody
        documents={documents}
        activeDocId={activeDocId}
        activeDoc={activeDoc}
        setDocuments={setDocuments}
        setActiveDocId={setActiveDocId}
      />
    </ResumeDesignProvider>
  );
};

export default ResumeClient;
