"use client";

// Ask about a job: which resume the answers are read against, and a way to change it
// (owner, 2026-10-05: "use master resume, and ... pick the resume the user wants it to use").
//
// The AI service keeps the pick on the job's thread and falls back to the newest ready resume
// when there is none. The master resume lives in My documents, which only this side can read, so
// the default is set from here: the first time a job is opened with nothing picked, the master's
// parse (read now if it never was, free and remembered on the file) becomes the job's resume.
// A person who picks another keeps it; the default never overrides a pick.

import { useEffect, useRef, useState, type FC } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import SelectResumeDialog, { type PickedResume } from "@/app/(pages)/(dashboard)/dashboard/apply/parts/SelectResumeDialog";
import { useDocuments } from "@/app/components/dashboard/documents/DocumentsProvider";
import { apiMessage } from "@/app/lib/api/core";
import { prepareResumeForDoc } from "@/app/lib/ats/api";
import { setJobThreadResume } from "@/app/lib/jobs/ask";
import type { JobThreadItem } from "@/app/lib/jobs/types";
import { qk } from "@/app/lib/query/keys";
import { useIngestedResumesQuery } from "@/hooks/queries/useAtsQueries";

const docName = (doc: { name: string; ext?: string | null }) => (doc.ext ? `${doc.name}.${doc.ext}` : doc.name);

const AskResumeBar: FC<{ thread: JobThreadItem; disabled?: boolean }> = ({ thread, disabled = false }) => {
  const queryClient = useQueryClient();
  const { docs, loading: docsLoading } = useDocuments();
  const ingested = useIngestedResumesQuery();
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  // A name learnt from a pick, for a resume neither list names yet (a made-here resume just imported).
  const [pickedName, setPickedName] = useState<{ resumeId: string; name: string } | null>(null);

  const save = async (resumeId: string) => {
    const fresh = await setJobThreadResume(thread.id, resumeId);
    queryClient.setQueryData<JobThreadItem>(qk.jobThreads.forSavedJob(thread.savedJobId), (current) => (current && current.id === fresh.id ? fresh : current));
  };

  // ---- The default: the master resume, once per thread, and never over a pick -------------------
  const defaulted = useRef<string | null>(null);
  useEffect(() => {
    if (thread.chosenResumeId || defaulted.current === thread.id || docsLoading || !ingested.data) return;
    const master = docs.find((doc) => doc.kind === "resume" && doc.master && !doc.archived);
    if (!master) return; // No master: the newest ready resume stands in, as the AI service does on its own.
    defaulted.current = thread.id;
    // Saved even when it is already the one used, so a newer upload later doesn't quietly take over.
    const linked = master.aiResumeId ? ingested.data.find((row) => row.resumeId === master.aiResumeId && row.status === "ready") : undefined;
    // The spinner is set from the chain, not the effect body, so the effect never renders twice.
    void Promise.resolve()
      .then(() => {
        setSaving(true);
        return linked ? linked.resumeId : prepareResumeForDoc(master.id).then((prepared) => prepared.resumeId);
      })
      .then((resumeId) => save(resumeId))
      // Unreadable for now: the newest resume keeps answering, and the person can still pick.
      .catch(() => undefined)
      .finally(() => setSaving(false));
    // `save` closes over the thread, which the deps already name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, thread.chosenResumeId, thread.resumeId, docs, docsLoading, ingested.data]);

  async function onPicked(picked: PickedResume) {
    setPicking(false);
    setSaving(true);
    try {
      await save(picked.resumeId);
      setPickedName(picked);
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const current = thread.resumeId;
  const name = !current
    ? null
    : pickedName?.resumeId === current
      ? pickedName.name
      : (() => {
          const doc = docs.find((d) => d.kind === "resume" && d.aiResumeId === current);
          if (doc) return docName(doc);
          return ingested.data?.find((row) => row.resumeId === current)?.fileName ?? "Your resume";
        })();

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-black/50">
      {saving ? <Loader2 className="h-3.5 w-3.5 flex-none animate-spin" aria-hidden /> : <FileText className="h-3.5 w-3.5 flex-none" aria-hidden />}
      {name ? (
        <span className="min-w-0 truncate">
          Answers use <span className="font-semibold text-primary">{name}</span>
        </span>
      ) : (
        <span>No resume yet</span>
      )}
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={() => setPicking(true)}
        disabled={disabled || saving}
        className="flex-none font-bold text-primary underline underline-offset-2 cursor-pointer disabled:cursor-default disabled:opacity-50">
        {name ? "Change resume" : "Pick a resume"}
      </button>
      <SelectResumeDialog open={picking} onOpenChange={setPicking} onPicked={(picked) => void onPicked(picked)} />
    </div>
  );
};

export default AskResumeBar;
