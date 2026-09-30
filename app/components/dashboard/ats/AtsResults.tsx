"use client";

// The scan report.
//
// Everything on this screen now comes from one real scan: the score, the four
// metrics, the requirements the resume missed, the keywords, the written
// breakdown and the suggested bullet rewrites. The panels arrive in two waves,
// because the service answers in two — the number is computed inside a
// sub-two-second deadline and the prose is one model call behind it. So the
// score, metrics, fixes and keywords render as soon as they exist, and the
// explanation slot shows that it is still being written.
//
// The "check off a fix and watch the number move" loop is kept, and is now
// honestly labelled: ticking a fix is a PROJECTION of what closing that gap is
// worth, not a rescore. Only a real scan moves the real number, and the
// projected figure is marked as such wherever it is shown.
//
// "Download report" writes the scan out as PDF (a clean print layout), Word or
// Markdown — see `app/lib/export/ats-report.ts`. It carries the scored number
// only, never the projection: a report outlives the screen it came from.

import { FC, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Download, FileText, Link2, Loader2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import TimeAgo from "timeago-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import AddToPlanButton from "@/app/components/dashboard/plan/AddToPlanButton";
import DownloadModal, { type DownloadFormat } from "@/app/components/dashboard/modals/DownloadModal";
import { ATS_BILLING_HREF, coveredKeywords, scanTier, unmetRequirements, type ScanFailure } from "@/app/lib/ats/api";
import { ATS_REPORT_CSS, atsReportHtml, atsReportToDocx, atsReportToMarkdown } from "@/app/lib/export/ats-report";
import { printDocument, safeFileName, saveBlob, saveText } from "@/app/lib/export/save";
import type { ScanReport } from "@/app/lib/ats/types";
import type { ScanStatus } from "@/hooks/mutations/useScanResume";
import { TASK_LIMITS } from "@/app/lib/tasks/types";
import type { VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";

/** The billing link wears the primary button's clothes, as the coach's does. */
const TOP_UP_LINK = cn(stickerButtonVariants({ variant: "primary", size: "md" }), "hover:shadow-[4px_4px_0_0_#e1f073]");

/** Where an ATS fix on the plan leads: the resume it asks you to change. */
const ATS_TASK_HREF = "/dashboard/resume";

export interface AtsResultsProps {
  resume: VaultDoc;
  /** Null until the score lands. Present while the explanation is still coming. */
  report: ScanReport | null;
  status: ScanStatus;
  failure: ScanFailure | null;
  /** Why there is no written breakdown, when the score arrived without one. */
  unexplained: string | null;
  /** When this report was produced — null before the first scan. */
  scannedAt: Date | null;
  resumes: VaultDoc[];
  /**
   * The posting being scored against, or null for a general score. Its `id`
   * (the saved job's) keys the fixes put on the plan, so the same fix against
   * two postings is two tasks.
   */
  job: { id?: string; company: string; role: string; description: string } | null;
  fixedIds: Set<string>;
  onToggleFix: (id: string) => void;
  onChangeResume: (id: string) => void;
  onChangeJob: () => void;
  onRemoveJob: () => void;
  onRetry: () => void;
  onExit: () => void;
}

/**
 * What closing one gap is projected to be worth.
 *
 * A real rescore is the only thing that moves the real number, so this is
 * shown as a projection and never written anywhere. It is weighted by the
 * requirement's own weight (1-5) so closing the thing the job is actually
 * about is visibly worth more than closing a nice-to-have.
 */
const projectedLift = (weight: number) => Math.max(1, Math.round(weight * 1.2));

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** The metric that needs a job description to mean anything. */
const KEYWORD_METRIC = "keyword-match";

const AtsResults: FC<AtsResultsProps> = ({
  resume,
  report,
  status,
  failure,
  unexplained,
  scannedAt,
  resumes,
  job,
  fixedIds,
  onToggleFix,
  onChangeResume,
  onChangeJob,
  onRemoveJob,
  onRetry,
  onExit,
}) => {
  const [keywordsOpen, setKeywordsOpen] = useState(true);
  const [downloadOpen, setDownloadOpen] = useState(false);

  // Missing and partial requirements, worst first — the fix list, and the
  // source of the projected lifts.
  const unmet = useMemo(() => (report ? unmetRequirements(report) : []), [report]);

  // Keywords the resume covered. The report carries only what is MISSING, so
  // the satisfied side is read off the verdicts — and trimmed the same way the
  // scorer trimmed the missing ones, or the two halves of the panel would read
  // at different lengths.
  const present = useMemo(() => (report ? coveredKeywords(report) : []), [report]);
  const missing = report?.gaps ?? [];

  const lift = useMemo(
    () => unmet.filter((v) => fixedIds.has(v.requirement.id)).reduce((sum, v) => sum + projectedLift(v.requirement.weight), 0),
    [unmet, fixedIds],
  );

  const base = report?.score ?? 0;
  const displayed = clamp(base + lift, 0, 100);
  const tier = scanTier(displayed);

  // `degraded` means the scan could not really compare against the posting, so
  // the keyword figure is not a finding. Dropping it beats showing a 0 that
  // reads as "you matched nothing".
  const metrics = (report?.metrics ?? []).filter((m) => !(m.id === KEYWORD_METRIC && (report?.degraded || !job)));

  const reportFileName = safeFileName(`ATS report - ${resume.name}${job ? ` - ${job.company}` : ""}`);

  /**
   * Writes the report on screen out, in the format picked. Read from `report`
   * at the moment of the click, so a write-up that landed after the score is
   * in it. The modal stays open and busy until this settles and shows a
   * failure itself.
   */
  async function handleDownload(format: DownloadFormat) {
    if (!report) throw new Error("The scan hasn't finished yet — try again in a moment.");
    const input = { report, resumeName: resume.name, job: job ? { company: job.company, role: job.role } : null, scannedAt };
    if (format === "docx") {
      saveBlob(await atsReportToDocx(input), `${reportFileName}.docx`);
      return;
    }
    if (format === "md") {
      saveText(atsReportToMarkdown(input), `${reportFileName}.md`);
      return;
    }
    await printDocument({ title: reportFileName, html: atsReportHtml(input), pageSize: "A4", pageMargin: "16mm 16mm", css: ATS_REPORT_CSS });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Context bar — what's being scored, and every way to change it. */}
      <DashCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 flex-none place-content-center rounded-full bg-[#f0f0ea]">
            <FileText className="h-4 w-4 text-primary" />
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-black/50">
              Scoring
              <select
                aria-label="Resume being scored"
                value={resume.id}
                onChange={(e) => onChangeResume(e.target.value)}
                className="cursor-pointer rounded-lg border border-black/15 bg-white px-2 py-1.5 text-sm font-bold text-primary outline-none focus:border-[#222325]">
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            {job ? (
              <>
                <span className="text-sm text-black/50">against</span>
                <Pill variant="active">
                  {job.company} · {job.role}
                </Pill>
              </>
            ) : (
              <Pill variant="neutral">General · your niche</Pill>
            )}
          </div>
          <div className="flex flex-none items-center gap-2">
            <StickerButton variant="outline" size="sm" onClick={onChangeJob}>
              <Link2 className="h-3.5 w-3.5" />
              {job ? "Change job" : "Score against a job"}
            </StickerButton>
            {job && (
              <StickerButton variant="outline" size="sm" onClick={onRemoveJob}>
                General instead
              </StickerButton>
            )}
            <button
              type="button"
              onClick={onExit}
              aria-label="Back to resume choice"
              title="Score a different resume"
              className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border-[1.5px] border-[#222325] bg-white text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </DashCard>

      {failure && <ScanFailureCard failure={failure} onRetry={onRetry} />}

      {!report && !failure && <ScanPendingCard status={status} resumeName={resume.name} />}

      {report && (
        <>
          {/* Score card */}
          <DashCard className="p-7">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-black/35">
                {job ? `Scored against ${job.company} · ${job.role}` : "General score · how your resume reads on its own"}
              </p>
              {scannedAt && (
                <p className="flex items-baseline gap-2 text-[11px] font-semibold text-black/45">
                  <span>
                    scanned <TimeAgo datetime={scannedAt} opts={{ minInterval: 10 }} />
                  </span>
                  <button
                    type="button"
                    onClick={onExit}
                    className="cursor-pointer font-bold text-black/55 underline decoration-2 underline-offset-2 transition-colors hover:text-[#b23c26]">
                    Clear scan
                  </button>
                </p>
              )}
            </div>

            {report.degraded && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#e0c060] bg-[#fdf6e3] px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-[#8a6d1f]" />
                <p className="text-xs leading-relaxed text-[#6b551a]">
                  {report.degradedReason ??
                    "Part of this scan ran on a reduced path, so treat the match as approximate."}{" "}
                  {job ? "Scanning again in a few minutes usually gives a firmer number." : null}
                </p>
              </div>
            )}

            <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
              <div className="relative flex-none">
                <ScoreRing value={displayed} size={164} />
                {lift > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full border-[1.5px] border-[#222325] bg-[#e1f073] px-2 py-0.5 text-xs font-bold text-[#222325] tabular-nums">
                    +{lift}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-4 text-center sm:items-start sm:text-left">
                <div>
                  <Pill variant={tier.tone} className="mb-2.5">
                    {tier.label}
                  </Pill>
                  <p className="max-w-md text-[15px] leading-relaxed text-black/70">
                    {job
                      ? `How ${resume.name} matches this posting, against ${report.verdicts.length} ${report.verdicts.length === 1 ? "requirement" : "requirements"} read from the description.`
                      : `How ${resume.name} reads on its own — structure, parseability, impact language and length. Add a job to score the match itself.`}
                  </p>
                  {lift > 0 && (
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-black/45">
                      {/* Said plainly: the ring is showing a projection right now. */}
                      Showing a projected {displayed} with your ticked fixes applied. Your scored number is {base} until you scan again.
                    </p>
                  )}
                </div>
                <StickerButton variant="outline" size="md" onClick={() => setDownloadOpen(true)}>
                  <Download className="h-4 w-4" />
                  Download report
                </StickerButton>
              </div>
            </div>
          </DashCard>

          {/* Metric tiles */}
          {metrics.length > 0 && (
            <div className={cn("grid gap-3.5", metrics.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
              {metrics.map((m) => (
                <DashCard key={m.id} className="p-4">
                  <p className="mb-2 text-xs font-semibold text-black/45">{m.label}</p>
                  <p className="mb-2.5 text-2xl font-bold text-primary tabular-nums">{m.value}%</p>
                  <ProgressBar value={m.value} fillColor={m.value >= 80 ? "#e1f073" : "#cddd54"} height="h-1.5" />
                </DashCard>
              ))}
            </div>
          )}

          <AtsExplanation report={report} status={status} unexplained={unexplained} />

          {/* Fixes — the requirements this resume did not cover. */}
          {unmet.length > 0 && (
            <DashCard className="p-0 overflow-hidden">
              <div className="border-b border-black/8 px-6 py-4">
                <p className="text-[15px] font-bold text-primary">
                  {unmet.length === 1 ? "One gap to close" : `${unmet.length} gaps to close`}
                </p>
                <p className="mt-0.5 text-xs text-black/45">
                  Read from the posting, heaviest first. Ticking one projects what closing it is worth — scan again to score it for real.
                </p>
              </div>
              {unmet.map((verdict) => {
                const { requirement } = verdict;
                const fixed = fixedIds.has(requirement.id);
                const quoted = verdict.evidence[0];
                return (
                  <div
                    key={requirement.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-black/6 px-6 py-4 last:border-b-0">
                    <div className="min-w-0 flex-1 basis-[240px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn("text-sm font-bold", fixed ? "text-black/40 line-through" : "text-primary")}>{requirement.text}</p>
                        <Pill variant={verdict.state === "missing" ? "urgent" : "neutral"}>
                          {verdict.state === "missing" ? "Not found" : "Partly covered"}
                        </Pill>
                        {requirement.type === "required" && <Pill variant="neutral">Required</Pill>}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-black/50">
                        {quoted
                          ? // The closest thing the resume already says, so the ask is "sharpen this", not "write something".
                            `Closest line in your resume: “${quoted.text}”`
                          : "Nothing in your resume speaks to this yet."}
                      </p>
                    </div>
                    <div className="flex flex-none items-start gap-2">
                      {/* Keyed on the requirement and the posting, not the resume:
                          one fix against one job is one task however many resumes
                          are tried, and a general scan's fixes share "none". */}
                      <AddToPlanButton
                        task={{
                          title: `Cover: ${requirement.text}`.slice(0, TASK_LIMITS.titleMax),
                          detail: (quoted ? `Closest line today: ${quoted.text}` : "Nothing in the resume speaks to this yet.").slice(
                            0,
                            TASK_LIMITS.detailMax,
                          ),
                          href: ATS_TASK_HREF,
                          dedupeKey: `ats:${requirement.id}:${job?.id || "none"}`,
                          metadata: { resumeId: resume.id, jobId: job?.id || null },
                        }}
                        source={{ kind: "ats", ref: job?.id || resume.id }}
                      />
                      <StickerButton
                        variant={fixed ? "outline" : "primary"}
                        size="sm"
                        className="flex-none"
                        onClick={() => onToggleFix(requirement.id)}>
                        {fixed ? "Undo" : `+${projectedLift(requirement.weight)}`}
                      </StickerButton>
                    </div>
                  </div>
                );
              })}
            </DashCard>
          )}

          {/* Keywords — what the posting asked for, and what the resume covered. */}
          {(present.length > 0 || missing.length > 0) && (
            <DashCard className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setKeywordsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left cursor-pointer">
                <div>
                  <p className="text-[15px] font-bold text-primary">
                    {job ? "Requirements read from the job description" : "What your resume covers"}
                  </p>
                  <p className="mt-0.5 text-xs text-black/45">
                    {present.length} covered · {missing.length} missing
                  </p>
                </div>
                <ChevronDown className={cn("h-4 w-4 flex-none text-black/40 transition-transform", keywordsOpen && "rotate-180")} />
              </button>
              {keywordsOpen && (
                <div className="border-t border-black/8 px-6 py-4">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {present.map((k) => (
                      <span key={k.id} className="rounded-lg bg-[#e1f073] px-3 py-1.5 text-xs font-semibold text-primary">
                        {k.label}
                      </span>
                    ))}
                    {missing.map((k) => (
                      <span
                        key={k.id}
                        className="rounded-lg border border-dashed border-black/30 px-3 py-1.5 text-xs font-semibold text-black/50">
                        {k.label}
                      </span>
                    ))}
                  </div>
                  <p className="border-t border-black/8 pt-3.5 text-xs leading-relaxed text-black/50">
                    Solid means the scan found it in your resume. Dashed means it didn&apos;t — only add what&apos;s honestly true of
                    your work.
                  </p>
                </div>
              )}
            </DashCard>
          )}
        </>
      )}

      <DownloadModal
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        docLabel="scan report"
        fileName={reportFileName}
        onDownload={handleDownload}
        helpers={{
          pdf: "A clean, printable layout of this scan — score, metrics, gaps and rewrites. Opens your browser's print dialog — choose \"Save as PDF\".",
          docx: "The same report as an editable Word document.",
          md: "The same report as plain-text markup — handy for notes or pasting elsewhere.",
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// The second wave: the write-up and the rewrites
// ---------------------------------------------------------------------------

/**
 * The written breakdown, and the bullet rewrites that came with it.
 *
 * Rendered as its own slot rather than folded into the score card because it
 * arrives later than everything above it — and because it can honestly never
 * arrive. A general score has no requirements to ground a paragraph in, and a
 * busy model is a missing paragraph rather than a failed scan, so "no write-up"
 * is a normal outcome with its own copy rather than an error.
 */
const AtsExplanation: FC<{ report: ScanReport; status: ScanStatus; unexplained: string | null }> = ({ report, status, unexplained }) => {
  if (report.explanation) {
    return (
      <DashCard className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#6c7a1e]" />
          <p className="text-[15px] font-bold text-primary">What this comes down to</p>
        </div>
        <p className="text-[15px] leading-relaxed text-black/70">{report.explanation}</p>

        {report.rewrites.length > 0 && (
          <div className="mt-5 border-t border-black/8 pt-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-black/35">
              Suggested rewrites — your words, sharpened
            </p>
            <div className="flex flex-col gap-3">
              {report.rewrites.map((rewrite) => (
                <div key={rewrite.chunkId} className="rounded-xl border border-black/10 bg-[#fbfbf7] p-4">
                  <p className="text-xs leading-relaxed text-black/45 line-through">{rewrite.before}</p>
                  <p className="mt-1.5 text-sm font-semibold leading-relaxed text-primary">{rewrite.after}</p>
                  {rewrite.why && <p className="mt-2 text-xs leading-relaxed text-black/50">{rewrite.why}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </DashCard>
    );
  }

  if (status === "explaining") {
    return (
      <DashCard className="flex items-center gap-3 p-6">
        <Loader2 className="h-4 w-4 flex-none animate-spin text-black/40" />
        <p className="text-sm text-black/55">Writing up what this comes down to…</p>
      </DashCard>
    );
  }

  if (unexplained) {
    return (
      <DashCard className="p-6">
        <p className="text-sm leading-relaxed text-black/55">{unexplained}</p>
      </DashCard>
    );
  }

  return null;
};

// ---------------------------------------------------------------------------
// Before the score, and instead of it
// ---------------------------------------------------------------------------

const PENDING_COPY: Partial<Record<ScanStatus, { title: string; detail: string }>> = {
  preparing: {
    title: "Reading your resume",
    detail: "First scan of this file — we're parsing it so the scorer can work line by line. This only happens once.",
  },
  scoring: { title: "Scoring", detail: "Matching your resume against what the posting asks for." },
};

const ScanPendingCard: FC<{ status: ScanStatus; resumeName: string }> = ({ status, resumeName }) => {
  const copy = PENDING_COPY[status] ?? PENDING_COPY.scoring!;
  return (
    <DashCard className="flex flex-col items-center gap-4 p-12 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-black/30" />
      <div>
        <p className="text-[15px] font-bold text-primary">
          {copy.title} · {resumeName}
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-black/50">{copy.detail}</p>
      </div>
    </DashCard>
  );
};

const ScanFailureCard: FC<{ failure: ScanFailure; onRetry: () => void }> = ({ failure, onRetry }) => (
  <DashCard className="flex flex-col items-center gap-4 p-10 text-center">
    <span className="grid h-11 w-11 place-content-center rounded-full bg-[#fdecea]">
      <AlertTriangle className="h-5 w-5 text-[#b23c26]" />
    </span>
    <div>
      <p className="text-[15px] font-bold text-primary">
        {failure.kind === "credits" ? "You're out of credits" : failure.kind === "resume" ? "That resume can't be scored" : "That scan didn't finish"}
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-black/55">{failure.message}</p>
    </div>
    <div className="flex flex-wrap items-center justify-center gap-2">
      {failure.kind === "credits" ? (
        // A new tab, so this report and its Retry are still here once the top-up is done.
        <Link href={ATS_BILLING_HREF} target="_blank" rel="noopener noreferrer" className={TOP_UP_LINK}>
          Top up credits
        </Link>
      ) : null}
      {failure.retryable && (
        <StickerButton variant={failure.kind === "credits" ? "outline" : "primary"} size="md" onClick={onRetry}>
          Try again
        </StickerButton>
      )}
    </div>
  </DashCard>
);

export default AtsResults;
