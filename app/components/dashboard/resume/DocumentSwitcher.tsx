"use client";

// Header dropdown for switching between EXISTING resume documents. Creating a
// new one is deliberately NOT a row in here — that's its own first-class
// button next to this trigger (see ResumeScreenBody), per the explicit user
// feedback that "+ New resume" shouldn't be buried in a menu.

import { useState, type FC } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResumeDocument } from "./resume-document";

export interface DocumentSwitcherProps {
  documents: ResumeDocument[];
  activeDocId: string;
  onSwitch: (id: string) => void;
}

const DocumentSwitcher: FC<DocumentSwitcherProps> = ({ documents, activeDocId, onSwitch }) => {
  const [open, setOpen] = useState(false);
  const active = documents.find((d) => d.id === activeDocId) ?? documents[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-black/12 bg-white px-3.5 py-2 text-sm font-semibold text-primary hover:border-black/25 transition-colors cursor-pointer">
        {active.label}
        <ChevronDown className={cn("h-3.5 w-3.5 text-black/40 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  onSwitch(doc.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm font-semibold transition-colors cursor-pointer",
                  doc.id === activeDocId ? "bg-[#f6f6f6] text-primary" : "text-black/60 hover:bg-[#f9f9f6]"
                )}>
                {doc.label}
                {doc.id === activeDocId && <Check className="h-3.5 w-3.5 flex-none" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentSwitcher;
