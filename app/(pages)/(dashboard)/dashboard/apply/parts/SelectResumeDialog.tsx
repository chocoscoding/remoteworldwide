"use client";

// "Select resume" — any resume already on the platform, as the one this
// application starts from (owner, 2026-10-03): the files in My documents and
// the resumes made in the resume creator, the same two lists My documents
// shows under Resumes.
//
// Picking one reads it in for scoring if it hasn't been yet: an uploaded file
// through the same bridge the ATS screen uses (free, and answered from the
// file's link after the first time), a made-here resume by importing its words
// (free, deduped on the text). Either way the answer is the ingested resume id
// that scans, letters and answers are written from.

import { useMemo, useState, type FC } from "react";
import TimeAgo from "timeago-react";
import { FileText, Loader2, PenLine, Search, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDocuments } from "@/app/components/dashboard/documents/DocumentsProvider";
import { apiMessage } from "@/app/lib/api/core";
import { prepareResumeForDoc } from "@/app/lib/ats/api";
import { getResumeDocument, importResumeContent, resumeContentToText } from "@/app/lib/resume/api";
import { useCreatedResumes } from "@/hooks/queries/useCreatedDocuments";
import { cn } from "@/lib/utils";

export interface PickedResume {
  resumeId: string;
  name: string;
}

interface Row {
  key: string;
  name: string;
  origin: "uploaded" | "created";
  id: string;
  master: boolean;
  at: number;
}

const SelectResumeDialog: FC<{ open: boolean; onOpenChange: (open: boolean) => void; onPicked: (picked: PickedResume) => void }> = ({
  open,
  onOpenChange,
  onPicked,
}) => {
  const { docs, loading } = useDocuments();
  const created = useCreatedResumes();
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const uploaded = docs
      .filter((doc) => doc.kind === "resume" && !doc.archived)
      .map((doc): Row => ({ key: `file:${doc.id}`, name: doc.ext ? `${doc.name}.${doc.ext}` : doc.name, origin: "uploaded", id: doc.id, master: Boolean(doc.master), at: doc.addedAt }));
    const made = (created.data ?? [])
      .filter((row) => !row.archived)
      .map((row): Row => ({ key: `resume:${row.id}`, name: row.label, origin: "created", id: row.id, master: false, at: new Date(row.updatedAt).getTime() }));
    // The master first: it is the default, and the one reviewers read.
    return [...uploaded, ...made].sort((a, b) => Number(b.master) - Number(a.master) || b.at - a.at);
  }, [docs, created.data]);

  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : rows;

  async function pick(row: Row) {
    if (picking) return;
    setPicking(row.key);
    setError(null);
    try {
      if (row.origin === "uploaded") {
        const prepared = await prepareResumeForDoc(row.id);
        onPicked({ resumeId: prepared.resumeId, name: row.name });
      } else {
        const doc = await getResumeDocument(row.id);
        // A resume started in the creator and never filled in has nothing to score.
        if (!resumeContentToText(doc.content).trim()) {
          setError(`“${doc.label}” is empty. Fill it in in the resume creator first, or pick another.`);
          return;
        }
        const imported = await importResumeContent(doc.content, doc.label);
        onPicked({ resumeId: imported.resumeId, name: doc.label });
      }
      onOpenChange(false);
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setPicking(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (picking) return;
        onOpenChange(next);
        if (!next) setError(null);
      }}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-white p-0">
        <div className="px-6 pb-4 pt-5 pr-14">
          <DialogTitle className="text-[17px] font-bold leading-tight text-primary">Select a resume</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-black/50">The one this application starts from. Your uploads and the resumes you made here.</DialogDescription>
          <div className="relative mt-4">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your resumes…"
              aria-label="Search your resumes"
              className="h-10 w-full rounded-lg border border-black/12 bg-white pl-9 pr-3 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-black/8 px-3 py-3">
          {(loading || created.isPending) && rows.length === 0 ? (
            <p role="status" className="flex items-center gap-2 px-3 py-4 text-sm text-black/50">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading your resumes…
            </p>
          ) : shown.length === 0 ? (
            <p className="px-3 py-4 text-sm text-black/50">{q ? `No resume matches “${query.trim()}”.` : "No resumes yet. Upload one instead."}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {shown.map((row) => (
                <li key={row.key}>
                  <button
                    type="button"
                    disabled={picking !== null}
                    onClick={() => void pick(row)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer hover:bg-[#f6f6f2] disabled:cursor-wait",
                      picking === row.key && "bg-[#f6faea]",
                    )}>
                    <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
                      {picking === row.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
                      ) : row.origin === "created" ? (
                        <PenLine className="h-3.5 w-3.5 text-primary" aria-hidden />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-primary">{row.name}</span>
                        {row.master && (
                          <span className="inline-flex flex-none items-center gap-0.5 rounded-full bg-[#e1f073] px-1.5 py-0.5 text-[10px] font-bold text-[#222325]">
                            <Star className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                            Master
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-black/45">
                        {row.origin === "created" ? "Made here · edited " : "Uploaded · added "}
                        <TimeAgo datetime={row.at} opts={{ minInterval: 60 }} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="border-t border-black/8 px-6 py-3 text-xs text-[#b23c26]" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SelectResumeDialog;
