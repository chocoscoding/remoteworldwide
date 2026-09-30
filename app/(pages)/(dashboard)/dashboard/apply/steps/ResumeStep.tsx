"use client";

// Step 2 — the resume this application goes out with.
//
// The list is the INGESTED resumes (`GET /api/ai/resume`): the CVs that have
// been parsed and embedded, which is the only kind a scan can score and a
// letter can be written from. Uploading one here puts it through the same
// import the resume builder uses.
//
// Nothing is spent without a click. The score is one scan (1 credit, and a
// re-scan of the same resume against the same posting is served from the
// service's cache for free). The two tools are the resume screen's own
// `tailor` and `keywords` (1 credit each), run against what the picked CV
// actually says; their result is a proposal, and "Use this version" files it as
// a new ingested resume (free — the import dedupes on the text) so the letter,
// the answers and the application all name the version that was sent.

import { useRef, useState, type FC } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, RotateCw, Sparkles, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { apiMessage } from "@/app/lib/api/core";
import { ATS_BILLING_HREF, SCAN_CREDITS, missingGaps, scanTier, unmetRequirements } from "@/app/lib/ats/api";
import type { IngestedResume } from "@/app/lib/ats/types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { qk } from "@/app/lib/query/keys";
import { SUGGESTION_CREDITS, injectKeywords, tailorToJob } from "@/app/lib/resume/ai";
import { RESUME_ACCEPT, importResume, importResumeContent } from "@/app/lib/resume/api";
import { useIngestedResumeQuery, useIngestedResumesQuery } from "@/hooks/queries/useAtsQueries";
import { useResumeSuggestion } from "@/hooks/mutations/useResumeSuggestion";
import type { StartedJob } from "../job";
import type { useApplyScan } from "../useApplyScan";

export interface ResumeStepProps {
  job: StartedJob;
  resumeId: string | null;
  onResumeChange: (resumeId: string) => void;
  scan: ReturnType<typeof useApplyScan>;
}

type Tool = "tailor" | "keywords";

interface Suggestion {
  tool: Tool;
  /** The resume it was proposed against — it means nothing once another is picked. */
  forResumeId: string;
  content: ResumeContent;
  /** The terms woven in (tailor) or added (keywords). */
  terms: string[];
}

/** The service caps an ingested row's label here. */
const LABEL_MAX = 120;

const ResumeStep: FC<ResumeStepProps> = ({ job, resumeId, onResumeChange, scan }) => {
  const queryClient = useQueryClient();
  const resumes = useIngestedResumesQuery();
  const detail = useIngestedResumeQuery(resumeId);
  const tools = useResumeSuggestion();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [adoptError, setAdoptError] = useState<string | null>(null);

  const rows = resumes.data ?? [];
  const selected = rows.find((row) => row.resumeId === resumeId) ?? null;
  const content = detail.data?.content ?? null;
  // A report for another resume is not this one's score.
  const scanHere = scan.resumeId !== null && scan.resumeId === resumeId;
  const report = scanHere ? scan.report : null;
  const gaps = report ? missingGaps(report) : [];
  const shownSuggestion = suggestion && suggestion.forResumeId === resumeId ? suggestion : null;

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const imported = await importResume(file);
      await queryClient.invalidateQueries({ queryKey: qk.ats.ingested() });
      onResumeChange(imported.resumeId);
    } catch (error) {
      setUploadError(apiMessage(error));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function score() {
    if (!resumeId) return;
    void scan.run({ resumeId, jdText: job.description, jobId: job.savedJobId });
  }

  async function runTool(tool: Tool) {
    if (!resumeId || !content) return;
    const forResumeId = resumeId;
    const input = {
      content,
      jdText: job.description,
      company: job.company,
      role: job.role,
      // The scan's own gap list, when there is one for this resume: the terms
      // the score says are missing, rather than the posting's top words.
      keywords: tool === "keywords" && gaps.length > 0 ? gaps.map((gap) => gap.label).slice(0, 12) : null,
    };
    setAdoptError(null);
    if (tool === "tailor") {
      const result = await tools.run("tailor", () => tailorToJob(input));
      if (result) setSuggestion({ tool, forResumeId, content: result.content, terms: result.woven });
    } else {
      const result = await tools.run("keywords", () => injectKeywords(input));
      if (result) setSuggestion({ tool, forResumeId, content: result.content, terms: result.added });
    }
  }

  async function adopt() {
    if (!shownSuggestion || adopting) return;
    setAdopting(true);
    setAdoptError(null);
    try {
      const base = (selected?.fileName ?? "Resume").replace(/\.[a-z0-9]+$/i, "");
      const label = `${base} — ${job.company}`.slice(0, LABEL_MAX);
      const imported = await importResumeContent(shownSuggestion.content, label);
      await queryClient.invalidateQueries({ queryKey: qk.ats.ingested() });
      setSuggestion(null);
      onResumeChange(imported.resumeId);
    } catch (error) {
      setAdoptError(apiMessage(error));
    } finally {
      setAdopting(false);
    }
  }

  const canTailor = Boolean(job.description);
  const canKeywords = Boolean(job.description) || gaps.length > 0;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.25fr_1fr]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Which resume */}
        <DashCard className="p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-primary">Which resume goes with it?</p>
              <p className="text-xs text-black/45">The one you pick is what gets scored, what the letter is written from, and what&apos;s recorded.</p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <StickerButton variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Reading" : "Upload"}
              </StickerButton>
              <input
                ref={fileRef}
                type="file"
                accept={RESUME_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </div>
          </div>

          {uploadError && <p className="mb-3 text-xs text-[#b23c26]">{uploadError}</p>}

          {resumes.isPending ? (
            <p role="status" className="inline-flex items-center gap-2 text-sm text-black/50">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading your resumes…
            </p>
          ) : resumes.isError ? (
            <p className="text-sm text-[#b23c26]">{apiMessage(resumes.error)}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm leading-relaxed text-black/55">
              No resume on file yet. Upload one (PDF, DOCX, TXT or MD) and it&apos;s read so it can be scored and written from.
            </p>
          ) : (
            <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto pr-1">
              {rows.map((row) => (
                <ResumeRow key={row.resumeId} row={row} selected={row.resumeId === resumeId} onSelect={() => onResumeChange(row.resumeId)} />
              ))}
            </div>
          )}
        </DashCard>

        {/* What it says */}
        {resumeId && (
          <DashCard className="p-6">
            {detail.isPending ? (
              <p role="status" className="inline-flex items-center gap-2 text-sm text-black/50">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Opening the resume…
              </p>
            ) : !content ? (
              <p className="text-sm text-black/55">{detail.isError ? apiMessage(detail.error) : "This resume hasn't been read yet."}</p>
            ) : (
              <ResumePreview content={content} />
            )}
          </DashCard>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {/* The score */}
        <DashCard className="flex flex-col gap-4 p-6">
          <div>
            <p className="mb-1 text-sm font-bold text-primary">ATS score for this job</p>
            <p className="text-xs text-black/45">
              {job.description ? "How well the resume matches this posting." : "No description on file, so this is a general score."}
            </p>
          </div>

          {scanHere && scan.status === "scoring" ? (
            <p role="status" className="inline-flex items-center gap-2 text-sm text-black/55">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Scoring against the posting…
            </p>
          ) : report ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold leading-none text-primary">{Math.round(report.score)}</span>
                  <span className="mb-0.5 text-sm text-black/45">/ 100</span>
                </div>
                <Pill variant={scanTier(report.score).tone}>{scanTier(report.score).label}</Pill>
              </div>
              <ProgressBar value={report.score} />
              {report.degraded && <p className="text-xs text-black/45">{report.degradedReason ?? "Scored on a reduced path — treat it as a rough read."}</p>}
              {scan.status === "explaining" && (
                <p className="inline-flex items-center gap-2 text-xs text-black/45">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Writing up why…
                </p>
              )}
              {report.explanation && <p className="text-xs leading-relaxed text-black/60">{report.explanation}</p>}
              {gaps.length > 0 && (
                <div className="border-t border-black/8 pt-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-black/40">Missing from your resume</p>
                  <div className="flex flex-wrap gap-1.5">
                    {gaps.slice(0, 10).map((gap) => (
                      <Pill key={gap.id} variant="outline-dashed">
                        {gap.label}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
              {unmetRequirements(report).length > 0 && (
                <ul className="flex flex-col gap-2 border-t border-black/8 pt-3">
                  {unmetRequirements(report)
                    .slice(0, 3)
                    .map((verdict) => (
                      <li key={verdict.requirement.id} className="flex items-start gap-2 text-xs leading-relaxed text-black/65">
                        <span className="mt-0.5 h-3.5 w-3.5 flex-none rounded-full border border-dashed border-black/30" aria-hidden />
                        <span>
                          {verdict.requirement.text}
                          <span className="text-black/40"> · {verdict.state === "partial" ? "partly covered" : "not covered"}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </>
          ) : scanHere && scan.failure ? (
            <div className="flex flex-col gap-2" role="alert">
              <p className="text-sm text-[#b23c26]">{scan.failure.message}</p>
              <div className="flex flex-wrap gap-2">
                {scan.failure.retryable && (
                  <StickerButton variant="outline" size="sm" onClick={score}>
                    <RotateCw className="h-3.5 w-3.5" />
                    Try again
                  </StickerButton>
                )}
                {scan.failure.kind === "credits" && (
                  <Link href={ATS_BILLING_HREF} target="_blank" rel="noopener noreferrer">
                    <StickerButton variant="primary" size="sm">
                      Top up credits
                    </StickerButton>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div>
              <StickerButton variant="primary" size="md" disabled={!resumeId || selected?.status !== "ready"} onClick={score}>
                <Sparkles className="h-4 w-4" />
                Score it · {SCAN_CREDITS} credit
              </StickerButton>
              {!resumeId && <p className="mt-2 text-xs text-black/45">Pick or upload a resume first.</p>}
            </div>
          )}
        </DashCard>

        {/* The tools */}
        <DashCard className="flex flex-col gap-4 p-6">
          <div>
            <p className="mb-1 text-sm font-bold text-primary">Make it fit this job</p>
            <p className="text-xs text-black/45">
              {SUGGESTION_CREDITS} credit a run. Nothing changes until you use the new version, which is saved as its own resume.
            </p>
          </div>

          {shownSuggestion ? (
            <SuggestionPanel
              suggestion={shownSuggestion}
              original={content}
              adopting={adopting}
              error={adoptError}
              onAdopt={() => void adopt()}
              onDiscard={() => setSuggestion(null)}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              <ToolButton
                label="Tailor summary & skills"
                detail={canTailor ? "Rewrites both toward this posting." : "Needs the job's description."}
                busy={tools.running === "tailor"}
                disabled={!content || !canTailor || tools.running !== null}
                onClick={() => void runTool("tailor")}
              />
              <ToolButton
                label="Work in missing keywords"
                detail={gaps.length > 0 ? "Uses the gaps the score found." : canKeywords ? "Uses the posting's own terms." : "Needs the description or a score."}
                busy={tools.running === "keywords"}
                disabled={!content || !canKeywords || tools.running !== null}
                onClick={() => void runTool("keywords")}
              />
              {tools.failure?.needsCredits && (
                <Link href={ATS_BILLING_HREF} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary underline underline-offset-2">
                  Top up credits
                </Link>
              )}
            </div>
          )}
        </DashCard>
      </div>
    </div>
  );
};

const ResumeRow: FC<{ row: IngestedResume; selected: boolean; onSelect: () => void }> = ({ row, selected, onSelect }) => {
  const ready = row.status === "ready";
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={!ready}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors",
        ready ? "cursor-pointer" : "cursor-not-allowed opacity-60",
        selected ? "border-[#222325] bg-[#f6faea]" : "border-black/12 hover:bg-[#f6f6f6]",
      )}>
      <FileText className="h-4 w-4 flex-none text-black/40" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-primary">{row.fileName}</span>
        <span className="block truncate text-xs text-black/45">
          {row.status === "failed" ? (row.error ?? "Couldn't be read") : row.status === "pending" ? "Still being read…" : `Version ${row.version}`}
        </span>
      </span>
      {selected && <Pill variant="positive">Sending this</Pill>}
    </button>
  );
};

const ResumePreview: FC<{ content: ResumeContent }> = ({ content }) => (
  <div className="rounded-xl bg-[#f0f0ea] p-5">
    <p className="text-sm font-bold text-primary">{content.name || "Name not found"}</p>
    <p className="mb-3 text-xs text-black/50">{[content.title, content.location].filter(Boolean).join(" · ")}</p>
    {content.summary && <p className="mb-4 line-clamp-5 text-sm leading-relaxed text-black/70">{content.summary}</p>}
    {content.experience.length > 0 && (
      <div className="flex flex-col gap-2.5 border-t border-black/8 pt-3">
        {content.experience.slice(0, 4).map((exp, i) => (
          <div key={exp.id || i}>
            <p className="text-xs font-bold text-primary">
              {exp.role} · {exp.company}
            </p>
            {exp.dates && <p className="text-[11px] text-black/40">{exp.dates}</p>}
          </div>
        ))}
      </div>
    )}
    {content.skills.length > 0 && <p className="mt-3 border-t border-black/8 pt-3 text-xs leading-relaxed text-black/55">{content.skills.slice(0, 14).join(" · ")}</p>}
  </div>
);

const ToolButton: FC<{ label: string; detail: string; busy: boolean; disabled: boolean; onClick: () => void }> = ({
  label,
  detail,
  busy,
  disabled,
  onClick,
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-black/12 bg-white px-3.5 py-3 text-left transition-colors hover:border-[#222325] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-black/12">
    {busy ? <Loader2 className="h-4 w-4 flex-none animate-spin text-primary" aria-hidden /> : <Sparkles className="h-4 w-4 flex-none text-black/40" aria-hidden />}
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-primary">{label}</span>
      <span className="block text-xs text-black/45">{detail}</span>
    </span>
    <span className="flex-none text-[11px] font-bold text-black/40">{SUGGESTION_CREDITS} cr</span>
  </button>
);

const SuggestionPanel: FC<{
  suggestion: Suggestion;
  original: ResumeContent | null;
  adopting: boolean;
  error: string | null;
  onAdopt: () => void;
  onDiscard: () => void;
}> = ({ suggestion, original, adopting, error, onAdopt, onDiscard }) => {
  const known = new Set((original?.skills ?? []).map((skill) => skill.toLowerCase()));
  const newSkills = suggestion.content.skills.filter((skill) => !known.has(skill.toLowerCase()));
  const summaryChanged = suggestion.content.summary.trim() !== (original?.summary ?? "").trim();
  const nothing = !summaryChanged && newSkills.length === 0 && suggestion.terms.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {nothing ? (
        <p className="text-sm text-black/60">Nothing to change — the resume already covers what this tool looks for.</p>
      ) : (
        <>
          {suggestion.terms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestion.terms.map((term) => (
                <Pill key={term} variant="positive">
                  {term}
                </Pill>
              ))}
            </div>
          )}
          {summaryChanged && (
            <div className="rounded-xl bg-[#f6faea] p-4">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-black/40">New summary</p>
              <p className="text-xs leading-relaxed text-black/70">{suggestion.content.summary}</p>
            </div>
          )}
          {newSkills.length > 0 && (
            <p className="text-xs leading-relaxed text-black/60">
              <span className="font-semibold text-black/70">Skills added:</span> {newSkills.join(", ")}
            </p>
          )}
        </>
      )}
      {error && <p className="text-xs text-[#b23c26]">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {!nothing && (
          <StickerButton variant="primary" size="sm" disabled={adopting} onClick={onAdopt}>
            {adopting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Use this version
          </StickerButton>
        )}
        <StickerButton variant="outline" size="sm" disabled={adopting} onClick={onDiscard}>
          <X className="h-3.5 w-3.5" />
          {nothing ? "Close" : "Discard"}
        </StickerButton>
      </div>
      {!nothing && <p className="text-[11px] text-black/40">Using it saves a copy for this job and picks it; score it again to see the difference.</p>}
    </div>
  );
};

export default ResumeStep;
