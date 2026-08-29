"use client";

import { FC } from "react";
import { Archive, ArchiveRestore, Link2, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { scoreApplication } from "@/app/lib/dashboard/ats-stub";
import { sourceBadgeLabel } from "@/app/components/dashboard/documents/DocumentsProvider";
import type { VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";

/**
 * Every resume, scored live — the same scoreApplication() the results view
 * uses, so this table can never disagree with a scan. Actions thread into the
 * real flow rather than jumping to a view about a different resume. Archive
 * state lives on the shared document itself, so My documents agrees.
 */
export interface AtsResumesTableProps {
  resumes: VaultDoc[];
  onToggleArchive: (id: string) => void;
  onGeneral: (id: string) => void;
  onVsJob: (id: string) => void;
}

const AtsResumesTable: FC<AtsResumesTableProps> = ({ resumes, onToggleArchive, onGeneral, onVsJob }) => (
  <DashCard className="p-0 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-6 py-4">
      <p className="text-[15px] font-bold text-primary">All your resumes, scored</p>
      <p className="text-xs text-black/45">General is against your target niche; job scores are against a specific posting</p>
    </div>

    <div className="hidden items-center gap-4 border-b border-black/6 bg-[#fbfbf7] px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-black/40 sm:flex">
      <span className="min-w-0 flex-1">Resume</span>
      <span className="w-28 flex-none">General</span>
      <span className="w-32 flex-none">Against a job</span>
      <span className="w-[230px] flex-none" />
    </div>

    {resumes.map((r) => {
      const archived = !!r.archived;
      const badge = sourceBadgeLabel(r.source);
      const general = scoreApplication(r.id, undefined).score;
      return (
        <div
          key={r.id}
          className={cn("flex flex-wrap items-center gap-4 border-b border-black/6 px-6 py-4 last:border-b-0", archived && "opacity-45")}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold text-primary">{r.name}</p>
              {badge && (
                <span className="flex-none rounded-full bg-[#f0f0ea] px-2 py-0.5 text-[10px] font-bold text-black/55">{badge}</span>
              )}
            </div>
            <p className="truncate text-xs text-black/45">{r.updatedLabel}</p>
          </div>

          <div className="flex w-28 flex-none items-center gap-2">
            <span className="text-base font-bold text-primary tabular-nums">{general}</span>
            <ProgressBar value={general} fillColor={general >= 80 ? "#e1f073" : "#cddd54"} height="h-1.5" className="w-11" />
          </div>

          <div className="w-32 flex-none">
            {r.jdScore != null ? (
              <span className="flex items-center gap-2">
                <span className="text-base font-bold text-primary tabular-nums">{r.jdScore}</span>
                <span className="text-xs font-bold text-[#6c7a1e]">{r.jdLabel}</span>
              </span>
            ) : (
              <span className="text-xs text-black/40">Not tied to a job</span>
            )}
          </div>

          <div className="flex w-[230px] flex-none items-center justify-end gap-2">
            {!archived && (
              <>
                <StickerButton variant="outline" size="sm" onClick={() => onGeneral(r.id)} title="Score against your niche">
                  <ScanSearch className="h-3.5 w-3.5" />
                  General
                </StickerButton>
                <StickerButton variant="outline" size="sm" onClick={() => onVsJob(r.id)} title="Score against a specific job">
                  <Link2 className="h-3.5 w-3.5" />
                  Vs a job
                </StickerButton>
              </>
            )}
            <button
              type="button"
              onClick={() => onToggleArchive(r.id)}
              aria-label={archived ? `Unarchive ${r.name}` : `Archive ${r.name}`}
              title={archived ? "Unarchive" : "Archive"}
              className="grid h-8 w-8 flex-none place-content-center rounded-lg border border-black/15 text-black/45 cursor-pointer transition-colors hover:border-[#222325] hover:text-primary">
              {archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      );
    })}
  </DashCard>
);

export default AtsResumesTable;
