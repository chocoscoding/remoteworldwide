"use client";

// "Build with AI" — the resume builder in the AI service, from the landing.
//
// The builder writes from what the user already has: an imported resume when
// there is one, their profile otherwise, and never from nothing (it refuses
// rather than invent a career). Aiming it at a saved job is optional. It saves
// the result to the library itself and returns that document, so what opens
// is the one row — nothing is created twice.
//
// Three credits, charged only when a resume comes back, and the dialog says so
// on the button that spends them.

import { useMemo, useState, type FC } from "react";
import Link from "next/link";
import { Briefcase, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import { useJobPicker } from "@/app/components/dashboard/jobs/JobPickerProvider";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { ATS_BILLING_HREF } from "@/app/lib/ats/api";
import type { PickedJob } from "@/app/lib/jobs/fields";
import { TEMPLATE_OPTIONS } from "@/app/lib/dashboard/resume/templates";
import { BUILD_CREDITS, buildResume, type StoredResumeDocument } from "@/app/lib/resume/api";
import { useIngestedResumesQuery } from "@/hooks/queries/useAtsQueries";

const SENIORITIES = ["Entry level", "Mid level", "Senior", "Lead", "Principal"] as const;

const BUILD_JOB_SPEC = "company, role, description?";
type BuildJob = PickedJob<typeof BUILD_JOB_SPEC>;

const FIELD = "rounded-xl border border-black/12 bg-[#fbfbf7] px-4 py-2.5 text-sm text-primary placeholder:text-black/35 outline-none focus:border-black/30 transition-colors";

export interface BuildResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The saved document the builder returned; the caller opens it. */
  onBuilt: (document: StoredResumeDocument) => void;
}

const BuildResumeDialog: FC<BuildResumeDialogProps> = ({ open, onOpenChange, onBuilt }) => {
  const { pickJob } = useJobPicker();
  const { data: ingested } = useIngestedResumesQuery();
  // The newest resume that parsed — the one they are most likely applying with.
  const source = useMemo(() => (ingested ?? []).find((row) => row.status === "ready") ?? null, [ingested]);

  const [targetRole, setTargetRole] = useState("");
  const [seniority, setSeniority] = useState("");
  const [template, setTemplate] = useState("");
  const [job, setJob] = useState<BuildJob | null>(null);
  const [useSource, setUseSource] = useState(true);
  const [building, setBuilding] = useState(false);
  const [failure, setFailure] = useState<{ message: string; credits: boolean } | null>(null);

  function close(next: boolean) {
    if (building) return;
    onOpenChange(next);
    if (!next) setFailure(null);
  }

  async function chooseJob() {
    const result = await pickJob(BUILD_JOB_SPEC);
    if (result.status !== "picked") return;
    setJob(result.job);
    if (!targetRole.trim()) setTargetRole(result.job.role);
  }

  async function build() {
    const role = targetRole.trim();
    if (!role || building) return;
    setBuilding(true);
    setFailure(null);
    try {
      const built = await buildResume({
        targetRole: role,
        seniority: seniority || null,
        template: template || null,
        jdText: job?.description ?? null,
        jobId: job?.id ?? null,
        fromResumeId: useSource && source ? source.resumeId : null,
      });
      if (!built.document) {
        setFailure({ message: "Your resume was built but couldn't be saved — please try again.", credits: false });
        return;
      }
      onBuilt(built.document);
      onOpenChange(false);
    } catch (error) {
      setFailure({ message: apiMessage(error), credits: error instanceof BackendError && error.status === 402 });
    } finally {
      setBuilding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="bg-white rounded-[20px] border-0 p-0 max-w-lg gap-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 flex-none rounded-full bg-[#e1f073] flex items-center justify-center">
              <Sparkles className="h-[18px] w-[18px] text-primary" />
            </div>
            <DialogTitle className="text-[17px] font-bold text-primary leading-none">Build a resume with AI</DialogTitle>
          </div>
          <p className="text-xs text-black/50 mb-5 pl-[52px]">
            Written from {source && useSource ? "your imported resume" : "your profile"} — nothing it doesn&apos;t already know about you.
          </p>

          <label className="flex flex-col gap-1.5 mb-4">
            <span className="text-xs font-semibold text-black/55">Role you&apos;re going for</span>
            <input
              type="text"
              autoFocus
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void build();
              }}
              maxLength={160}
              placeholder="e.g. Senior Product Designer"
              className={FIELD}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-black/55">Seniority</span>
              <select value={seniority} onChange={(e) => setSeniority(e.target.value)} className={cn(FIELD, "cursor-pointer")}>
                <option value="">Any</option>
                {SENIORITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-black/55">Template</span>
              <select value={template} onChange={(e) => setTemplate(e.target.value)} className={cn(FIELD, "cursor-pointer")}>
                <option value="">Let the AI choose</option>
                {TEMPLATE_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-4">
            <span className="mb-1.5 block text-xs font-semibold text-black/55">Aim it at a job (optional)</span>
            {job ? (
              <div className="flex items-center gap-3 rounded-xl border border-black/12 bg-[#fbfbf7] px-4 py-2.5">
                <Briefcase className="h-4 w-4 flex-none text-black/45" />
                <span className="min-w-0 flex-1 truncate text-sm text-primary">
                  <span className="font-semibold">{job.role}</span> at {job.company}
                  {!job.description && <span className="text-black/45"> · no description, so only the role is used</span>}
                </span>
                <button type="button" aria-label="Remove the job" onClick={() => setJob(null)} className="cursor-pointer text-black/40 hover:text-primary">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <StickerButton type="button" variant="outline" size="sm" onClick={() => void chooseJob()}>
                <Briefcase className="h-3.5 w-3.5" />
                Pick a saved job
              </StickerButton>
            )}
          </div>

          {source && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-black/10 px-4 py-3">
              <input type="checkbox" checked={useSource} onChange={(e) => setUseSource(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#222325]" />
              <span className="text-xs leading-relaxed text-black/60">
                Build from <span className="font-semibold text-primary">{source.fileName}</span>, the resume you imported last. Untick to use your profile only.
              </span>
            </label>
          )}

          {failure && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#b23c26]/20 bg-[#fdf4f2] px-4 py-3" role="alert">
              <p className="min-w-0 flex-1 text-sm text-[#b23c26]">{failure.message}</p>
              {failure.credits && (
                <Link href={ATS_BILLING_HREF} target="_blank" className={cn(stickerButtonVariants({ variant: "primary", size: "sm" }))}>
                  Get credits
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2.5 border-t border-black/8 px-6 py-4">
          <p className="text-xs text-black/50">{building ? "Writing your resume — this can take up to half a minute." : `${BUILD_CREDITS} credits, only if it builds.`}</p>
          <div className="flex flex-none items-center gap-2.5">
            <StickerButton type="button" variant="outline" size="md" disabled={building} onClick={() => close(false)}>
              Cancel
            </StickerButton>
            <StickerButton type="button" variant="primary" size="md" disabled={building || !targetRole.trim()} onClick={() => void build()}>
              {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {building ? "Building…" : "Build it"}
            </StickerButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BuildResumeDialog;
