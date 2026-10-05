"use client";

// The resume rewrite gift: pick a resume, say the role, and the AI builder writes a fresh one from
// it, paid for by the gift instead of credits or a plan.
//
// The gift is never "used" on its own. The build carries `gift: "rewrite"`, and the AI service
// takes the gift from the backend before it builds and gives it back if the build fails, so a
// rewrite that never arrived costs nothing. A refusal (409 no gift left or a full library, 503 the
// gift couldn't be checked, 400 no source) shows the service's own message, and the gifts refetch.
//
// The list is the one "Select a resume" shows in the apply wizard: the files in My documents and
// the resumes made here. An uploaded file is read in through the same free bridge the ATS screen
// uses; a made-here resume is named to the builder directly.

import { useMemo, useState, type FC } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import TimeAgo from "timeago-react";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, PenLine, Search, Sparkles, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDocuments } from "@/app/components/dashboard/documents/DocumentsProvider";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import { Loading, RowsSkeleton } from "@/app/components/dashboard/ui/Skeleton";
import { apiMessage } from "@/app/lib/api/core";
import { getIngestedResume, prepareResumeForDoc } from "@/app/lib/ats/api";
import { buildResume, getResumeDocument, type StoredResumeDocument } from "@/app/lib/resume/api";
import { qk } from "@/app/lib/query/keys";
import { refreshStreak } from "@/hooks/mutations/useStreakMutations";
import { useCreatedResumes } from "@/hooks/queries/useCreatedDocuments";
import { cn } from "@/lib/utils";

interface Row {
  key: string;
  name: string;
  origin: "uploaded" | "created";
  id: string;
  master: boolean;
  at: number;
}

/** The picked resume, read far enough to build from: its ingested id when it is a file. */
interface Source {
  row: Row;
  resumeId: string | null;
}

const FIELD =
  "w-full rounded-xl border border-black/12 bg-[#fbfbf7] px-4 py-2.5 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]";

const RewriteGiftDialog: FC<{ open: boolean; onOpenChange: (open: boolean) => void; onDone?: () => void }> = ({ open, onOpenChange, onDone }) => {
  const queryClient = useQueryClient();
  const { docs, loading } = useDocuments();
  const created = useCreatedResumes();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [built, setBuilt] = useState<StoredResumeDocument | null>(null);

  const rows = useMemo<Row[]>(() => {
    const uploaded = docs
      .filter((doc) => doc.kind === "resume" && !doc.archived)
      .map((doc): Row => ({ key: `file:${doc.id}`, name: doc.ext ? `${doc.name}.${doc.ext}` : doc.name, origin: "uploaded", id: doc.id, master: Boolean(doc.master), at: doc.addedAt }));
    const made = (created.data ?? [])
      .filter((row) => !row.archived)
      .map((row): Row => ({ key: `resume:${row.id}`, name: row.label, origin: "created", id: row.id, master: false, at: new Date(row.updatedAt).getTime() }));
    return [...uploaded, ...made].sort((a, b) => Number(b.master) - Number(a.master) || b.at - a.at);
  }, [docs, created.data]);

  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : rows;

  function reset() {
    setQuery("");
    setSource(null);
    setReading(null);
    setRole("");
    setError(null);
    setBuilt(null);
  }

  function close(next: boolean) {
    if (building || reading) return;
    onOpenChange(next);
    if (!next) reset();
  }

  /** Reads the picked resume far enough to build from, and its own title as the role to suggest. */
  async function pick(row: Row) {
    if (reading || building) return;
    setReading(row.key);
    setError(null);
    try {
      if (row.origin === "uploaded") {
        const prepared = await prepareResumeForDoc(row.id);
        const detail = await getIngestedResume(prepared.resumeId).catch(() => null);
        setSource({ row, resumeId: prepared.resumeId });
        setRole(detail?.content?.title?.trim() ?? "");
      } else {
        const doc = await getResumeDocument(row.id);
        setSource({ row, resumeId: null });
        setRole(doc.content?.title?.trim() ?? "");
      }
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setReading(null);
    }
  }

  async function rewrite() {
    const targetRole = role.trim();
    if (!source || !targetRole || building) return;
    setBuilding(true);
    setError(null);
    try {
      const result = await buildResume({
        targetRole,
        fromDocumentId: source.row.origin === "created" ? source.row.id : null,
        fromResumeId: source.row.origin === "uploaded" ? source.resumeId : null,
        gift: "rewrite",
      });
      // The gift is spent (or given back) on the server: the store, the streak's count, the
      // resume lists and the bell all catch up.
      refreshStreak(queryClient);
      for (const queryKey of [qk.resumes.library(), qk.resumes.list(), qk.notifications.all]) void queryClient.invalidateQueries({ queryKey });
      if (!result.document) {
        setError("Your rewrite was built but couldn't be saved. Try again in a moment.");
        return;
      }
      setBuilt(result.document);
    } catch (caught) {
      // No gift left, a resume too thin to build from, the service busy: its own words.
      refreshStreak(queryClient);
      setError(apiMessage(caught));
    } finally {
      setBuilding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-white p-0">
        <div className="px-6 pb-4 pt-5 pr-14">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 flex-none place-content-center rounded-full bg-[#e1f073]">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <DialogTitle className="text-[17px] font-bold leading-tight text-primary">
              {built ? "Rewritten with your gift" : source ? "Rewrite it for" : "Pick a resume to rewrite"}
            </DialogTitle>
          </div>
          <DialogDescription className="mt-2 text-xs leading-relaxed text-black/50">
            {built
              ? "A new resume, saved next to your others. The one you picked is untouched."
              : "Your gift pays for one full AI rewrite: no credits, any plan. If it doesn't build, you keep the gift."}
          </DialogDescription>
          {!source && !built && (
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
          )}
        </div>

        {built ? (
          <div className="border-t border-black/8 px-6 py-5">
            <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-[#fbfbf7] px-4 py-3">
              <span className="grid h-8 w-8 flex-none place-content-center rounded-full bg-[#e1f073]">
                <Check className="h-4 w-4 text-primary" strokeWidth={3} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{built.label}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2.5">
              <StickerButton variant="outline" size="md" onClick={() => close(false)}>
                Close
              </StickerButton>
              <Link
                href={`/dashboard/resume?doc=${encodeURIComponent(built.id)}`}
                onClick={() => {
                  close(false);
                  onDone?.();
                }}
                className={stickerButtonVariants({ variant: "primary", size: "md" })}>
                Open it
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : source ? (
          <div className="border-t border-black/8 px-6 py-5">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-black/10 px-3.5 py-2.5">
              <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
                {source.row.origin === "created" ? <PenLine className="h-3.5 w-3.5 text-primary" aria-hidden /> : <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{source.row.name}</span>
              <button
                type="button"
                onClick={() => {
                  setSource(null);
                  setError(null);
                }}
                disabled={building}
                className="inline-flex flex-none cursor-pointer items-center gap-1 text-xs font-semibold text-black/50 hover:text-primary disabled:cursor-default disabled:opacity-50">
                <ArrowLeft className="h-3 w-3" aria-hidden />
                Change
              </button>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-black/55">Role you&apos;re going for</span>
              <input
                type="text"
                autoFocus
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void rewrite();
                }}
                maxLength={160}
                placeholder="e.g. Senior Product Designer"
                disabled={building}
                className={FIELD}
              />
            </label>
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs text-black/50">{building ? "Writing your resume. This can take up to half a minute." : "Free with your gift."}</p>
              <StickerButton variant="primary" size="md" disabled={building || !role.trim()} onClick={() => void rewrite()}>
                {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {building ? "Rewriting…" : "Rewrite it"}
              </StickerButton>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-black/8 px-3 py-3">
            {(loading || created.isPending) && rows.length === 0 ? (
              <Loading label="Loading your resumes">
                <RowsSkeleton rows={4} bordered={false} />
              </Loading>
            ) : shown.length === 0 ? (
              <p className="px-3 py-4 text-sm text-black/50">
                {q ? `No resume matches “${query.trim()}”.` : "No resumes yet. Upload one in My documents or make one in the resume creator first."}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {shown.map((row) => (
                  <li key={row.key}>
                    <button
                      type="button"
                      disabled={reading !== null}
                      onClick={() => void pick(row)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#f6f6f2] disabled:cursor-wait",
                        reading === row.key && "animate-pulse bg-[#f6faea]",
                      )}>
                      <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
                        {row.origin === "created" ? <PenLine className="h-3.5 w-3.5 text-primary" aria-hidden /> : <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />}
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
        )}

        {error && (
          <p className="border-t border-black/8 px-6 py-3 text-xs text-[#b23c26]" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RewriteGiftDialog;
