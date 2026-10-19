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
import { AlertTriangle, ChevronDown, Download, Loader2, RotateCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TimeAgo from "timeago-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import AddToPlanButton from "@/app/components/dashboard/plan/AddToPlanButton";
import DownloadModal, { type DownloadFormat } from "@/app/components/dashboard/modals/DownloadModal";
import {
  ATS_BILLING_HREF,
  HEADLINE_SHARES,
  MAX_SCAN_SCORE,
  STUFFING_ADVICE,
  coveredKeywords,
  isUnchecked,
  partialLine,
  projectedLifts,
  scanCoverage,
  scanTier,
  scoreMakeup,
  stuffingHeadline,
  unmetRequirements,
  type ScanFailure,
} from "@/app/lib/ats/api";
import { fixHref, fixInstruction, fixesFor, writeFixHandoff } from "@/app/lib/ats/fix-handoff";
import { scoreStep, scoreStepTrack } from "@/app/lib/ats/score-steps";
import { ATS_REPORT_CSS, atsReportHtml, atsReportToDocx, atsReportToMarkdown } from "@/app/lib/export/ats-report";
import { printDocument, safeFileName, saveBlob, saveText } from "@/app/lib/export/save";
import type { ScanReport } from "@/app/lib/ats/types";
import type { ScanStatus } from "@/hooks/mutations/useScanResume";
import { TASK_LIMITS } from "@/app/lib/tasks/types";
import type { VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";

/** The billing link wears the primary button's clothes, as the coach's does. */
const TOP_UP_LINK = cn(stickerButtonVariants({ variant: "primary", size: "md" }), "br-lime");

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

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const requirementCount = (n: number) => `${n} ${n === 1 ? "requirement" : "requirements"}`;

/** The General / Against a job switch's two halves. */
const SEGMENT = "rounded-md px-3 py-1 text-sm font-semibold transition-colors";
const SEGMENT_ON = "bg-white text-primary br-shadow";

/** The metric that needs a job description to mean anything. */
const KEYWORD_METRIC = "keyword-match";

/**
 * What the posting says that is not a gap to close (owner, 2026-10-18): the problems the employer
 * needs solved, where the candidate must be or may work (check it, it never goes on a resume), the
 * personal qualities to show in a cover letter or interview, and why a resume reads as stuffed.
 */
const PostingNotes: FC<{ report: ScanReport; company: string | null }> = ({ report, company }) => {
  const needs = report.needs ?? [];
  const eligibility = report.eligibility ?? [];
  const traits = report.traits ?? [];
  const stuffing = report.stuffing ?? [];
  if (needs.length + eligibility.length + traits.length + stuffing.length === 0) return null;
  return (
    <DashCard className="flex flex-col gap-4 p-6">
      {stuffing.length > 0 && (
        <p className="rounded-lg border border-dashed border-[#b23c26]/35 px-3.5 py-2.5 text-[13px] leading-relaxed text-black/70">
          <span className="font-semibold text-[#b23c26]">{stuffingHeadline(report.stuffingPenalty)}</span> {stuffing.join("; ")}. {STUFFING_ADVICE}
        </p>
      )}
      {needs.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/45">{company ? `What ${company} needs solved` : "What they need solved"}</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm leading-relaxed text-black/75">
            {needs.map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ul>
        </div>
      )}
      {eligibility.length > 0 && (
        <div className="rounded-lg border border-[#b26a00]/30 bg-[#fff8ec] px-3.5 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a5200]">This role needs</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[13px] leading-relaxed text-black/75">
            {eligibility.map((note) => (
              <li key={note.id}>{note.text}. Check you meet it; it never goes on your resume, and it isn&apos;t in the score.</li>
            ))}
          </ul>
        </div>
      )}
      {traits.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/45">Show these in your cover letter or interview</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {traits.map((note) => (
              <Pill key={note.id} variant="outline-dashed">
                {note.label || note.text}
              </Pill>
            ))}
          </div>
        </div>
      )}
    </DashCard>
  );
};

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
  const router = useRouter();

  // Missing and partial requirements, worst first — the fix list, and the
  // source of the projected lifts.
  const unmet = useMemo(() => (report ? unmetRequirements(report) : []), [report]);

  // Keywords the resume covered. The report carries only what is MISSING, so
  // the satisfied side is read off the verdicts — and trimmed the same way the
  // scorer trimmed the missing ones, or the two halves of the panel would read
  // at different lengths.
  const present = useMemo(() => (report ? coveredKeywords(report) : []), [report]);
  const missing = report?.gaps ?? [];

  // A scan that could check only part of the posting says so, the way the apply step does (owner,
  // 2026-10-19): "Partly checked", how much was checked, Rescore; its keyword match is "not checked",
  // never a 0 that reads as "you matched nothing", and its number is never given a tier.
  const coverage = report && job ? scanCoverage(report) : null;
  const partial = coverage?.partial ?? false;
  const metrics = (report?.metrics ?? []).filter((m) => !(m.id === KEYWORD_METRIC && !job));
  const keywordChecked = Boolean(job) && !coverage?.keywordUnchecked;
  // What the number is made of, worded as the downloaded report words it.
  const makeup = report ? scoreMakeup(report, { keywordChecked, checked: coverage?.checked ?? 0 }) : null;

  const base = report?.score ?? 0;
  // Nothing scores 100 (owner, 2026-10-18), the projection included, so no fix is worth more than the room left.
  const headroom = Math.max(0, MAX_SCAN_SCORE - base);
  // Closing a gap moves keyword match and nothing else, so a scan that could not check it projects nothing.
  // An old scan, scored when the score was keyword match alone, projects nothing: a rescore gives the real number.
  const projecting = keywordChecked && headroom > 0 && makeup?.current !== false;
  // What closing each gap is projected to add, the scorer's own arithmetic (`projectedLifts`). A real
  // rescore is the only thing that moves the real number, so this is shown and never written anywhere.
  const lifts = useMemo(() => (report ? projectedLifts(report) : new Map<string, number>()), [report]);
  const gapLift = (id: string) => Math.min(headroom, Math.max(1, Math.round(lifts.get(id) ?? 0)));
  const lift = useMemo(() => {
    if (!projecting) return 0;
    const sum = unmet.filter((v) => fixedIds.has(v.requirement.id)).reduce((total, v) => total + (lifts.get(v.requirement.id) ?? 0), 0);
    return Math.min(headroom, Math.round(sum));
  }, [unmet, fixedIds, projecting, headroom, lifts]);

  const displayed = clamp(base + lift, 0, MAX_SCAN_SCORE);
  const tier = scanTier(displayed);

  // Everything the report suggests, as the editor's AI will read it ("Fix these in my resume").
  const posting = useMemo(() => (job ? { company: job.company, role: job.role, description: job.description } : null), [job]);
  const fixes = useMemo(() => (report ? fixesFor(report, posting) : []), [report, posting]);
  // A general scan (or one that could not check keyword match) gets one or two fixes from its weakest
  // sections. A job scan works from its gaps, and since how it reads is 30% of its score (owner,
  // 2026-10-19), at most one fix for that part too, shown after them.
  const advice = keywordChecked ? (report?.advice ?? []).slice(0, 1) : (report?.advice ?? []);

  const fixInEditor = () => {
    if (!report) return;
    writeFixHandoff({ resumeId: resume.id, report, job: posting, fixes, instruction: fixInstruction(posting) });
    router.push(fixHref(resume));
  };

  const reportFileName = safeFileName(`ATS report - ${resume.name}${job ? ` - ${job.company}` : ""}`);

  /**
   * Writes the report on screen out, in the format picked. Read from `report`
   * at the moment of the click, so a write-up that landed after the score is
   * in it. Saved under the name in the download dialog's field (`reportFileName`,
   * or what they changed it to). The modal stays open and busy until this
   * settles and shows a failure itself.
   */
  async function handleDownload(format: DownloadFormat, fileName: string) {
    if (!report) throw new Error("The scan hasn't finished yet. Try again in a moment.");
    const input = { report, resumeName: resume.name, job: job ? { company: job.company, role: job.role } : null, scannedAt };
    if (format === "docx") {
      saveBlob(await atsReportToDocx(input), `${fileName}.docx`);
      return;
    }
    if (format === "md") {
      saveText(atsReportToMarkdown(input), `${fileName}.md`);
      return;
    }
    await printDocument({ title: fileName, html: atsReportHtml(input), pageSize: "A4", pageMargin: "16mm 16mm", css: ATS_REPORT_CSS });
  }

  // Under 85, what to fix in how the resume reads: before the explanation on a general scan, after
  // the gaps on a job scan, where it is the one more lever beside them.
  const adviceCard =
    advice.length > 0 ? (
      <DashCard className="p-6">
        <p className="text-[15px] font-bold text-primary">
          {keywordChecked ? "One more thing that moves the number" : advice.length === 1 ? "One thing to fix first" : "Two things to fix first"}
        </p>
        <p className="mt-0.5 text-xs text-black/45">
          {keywordChecked
            ? `How your resume reads is ${100 - HEADLINE_SHARES["keyword-match"]}% of your score. This is where it reads weakest.`
            : `From the ${advice.length === 1 ? "section" : "sections"} scoring lowest. These move the number most.`}
        </p>
        <ol className="mt-4 flex flex-col gap-4">
          {advice.map((item, index) => (
            <li key={item.id} className="flex gap-3">
              <span className="grid h-6 w-6 flex-none place-content-center rounded-full border-[1.5px] border-[#222325] text-xs font-bold text-primary tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary">{item.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-black/60">{item.detail}</p>
                {item.lines.map((line) => (
                  <p key={line} className="mt-1.5 rounded-lg bg-[#f6f6f1] px-3 py-1.5 text-xs leading-relaxed text-black/55">
                    &ldquo;{line}&rdquo;
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </DashCard>
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* What's being scored, on one line (owner, 2026-10-18: it was breaking and too busy). */}
      <DashCard className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:flex-nowrap">
          <select
            aria-label="Resume being scored"
            value={resume.id}
            onChange={(e) => onChangeResume(e.target.value)}
            className="min-w-0 max-w-full cursor-pointer truncate rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-sm font-bold text-primary outline-none focus:border-[#222325] md:max-w-[18rem]">
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div role="group" aria-label="Score it" className="inline-flex flex-none rounded-lg border border-black/12 bg-[#f6f6f1] p-0.5">
            <button
              type="button"
              aria-pressed={!job}
              onClick={job ? onRemoveJob : undefined}
              className={cn(SEGMENT, !job ? SEGMENT_ON : "cursor-pointer text-black/55 hover:text-primary")}>
              General
            </button>
            <button
              type="button"
              aria-pressed={Boolean(job)}
              onClick={onChangeJob}
              className={cn(SEGMENT, "cursor-pointer", job ? SEGMENT_ON : "text-black/55 hover:text-primary")}>
              Against a job
            </button>
          </div>
          {job && (
            <button
              type="button"
              onClick={onChangeJob}
              title="Change job"
              className="min-w-0 cursor-pointer truncate text-sm text-black/60 underline-offset-2 hover:text-primary hover:underline">
              {job.company} · {job.role}
            </button>
          )}
        </div>
      </DashCard>

      {failure && <ScanFailureCard failure={failure} onRetry={onRetry} />}

      {!report && !failure && <ScanPendingCard status={status} resumeName={resume.name} />}

      {report && (
        <>
          {/* Score card */}
          <DashCard className="p-7">
            <div className="mb-5 flex flex-wrap items-baseline justify-end gap-2">
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

            {report.degraded && !partial && (
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
                <ScoreRing value={displayed} size={164} fillColor={scoreStep(displayed).color} trackColor={scoreStepTrack(displayed)} />
                {lift > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full border-[1.5px] border-[#222325] bg-[#e1f073] px-2 py-0.5 text-xs font-bold text-[#222325] tabular-nums">
                    +{lift}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-4 text-center sm:items-start sm:text-left">
                <div>
                  {partial && coverage ? (
                    <>
                      <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#fdf1d6] px-2.5 py-1 text-xs font-extrabold text-[#a06f00]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Partly checked
                      </span>
                      <p className="max-w-md text-[15px] leading-relaxed text-black/70">
                        {partialLine(coverage)} {makeup?.partial}
                      </p>
                      <StickerButton variant="primary" size="sm" className="mt-3" onClick={onRetry}>
                        <RotateCw className="h-3.5 w-3.5" />
                        Rescore
                      </StickerButton>
                    </>
                  ) : (
                    <>
                      <Pill variant={tier.tone} className="mb-2.5">
                        {tier.label}
                      </Pill>
                      <p className="max-w-md text-[15px] leading-relaxed text-black/70">
                        {/* A job score is mostly the match, not only it (owner, 2026-10-19); an older scan was the match alone. */}
                        {!job
                          ? "How it reads on its own: structure, impact and length. Add a job to score the match."
                          : !keywordChecked
                            ? "Nothing in the posting could be scored, so the number shows how it reads on its own: structure, impact and length."
                            : makeup?.current === false
                              ? `Against ${requirementCount(report.verdicts.length)} read from the posting.`
                              : `${HEADLINE_SHARES["keyword-match"]}% how you cover the ${requirementCount(report.verdicts.length)} read from the posting, ${100 - HEADLINE_SHARES["keyword-match"]}% how it reads: impact, structure and length.`}
                      </p>
                    </>
                  )}
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
              {metrics.map((m) => {
                const notChecked = isUnchecked(m) || (m.id === KEYWORD_METRIC && Boolean(coverage?.keywordUnchecked));
                return (
                  <DashCard key={m.id} className="p-4">
                    <p className="mb-2 text-xs font-semibold text-black/45">{m.label}</p>
                    {notChecked || m.value === null ? (
                      <>
                        <p className="mb-2.5 text-base font-bold text-[#a06f00]">Not checked</p>
                        <ProgressBar value={0} height="h-1.5" />
                      </>
                    ) : (
                      <>
                        <p className="mb-2.5 text-2xl font-bold text-primary tabular-nums">{m.value}%</p>
                        <ProgressBar value={m.value} height="h-1.5" fillClassName={scoreStep(m.value).fill} />
                      </>
                    )}
                  </DashCard>
                );
              })}
            </div>
          )}
          {/* How the tiles make the ring, so the person can add it up (owner, 2026-10-19). */}
          {metrics.length > 0 && makeup?.recipe && <p className="-mt-2 px-1 text-xs leading-relaxed text-black/50">{makeup.recipe}</p>}

          {!keywordChecked && adviceCard}

          <AtsExplanation report={report} status={status} unexplained={unexplained} />

          {/* Beside the score, never in it (RWW/ATS-QUALITY-PLAN.md, 1.2/1.3/13.4/13.6). */}
          <PostingNotes report={report} company={job?.company ?? null} />

          {/* Fixes — the requirements this resume did not cover. */}
          {unmet.length > 0 && (
            <DashCard className="p-0 overflow-hidden">
              <div className="border-b border-black/8 px-6 py-4">
                <p className="text-[15px] font-bold text-primary">
                  {unmet.length === 1 ? "One gap to close" : `${unmet.length} gaps to close`}
                </p>
                <p className="mt-0.5 text-xs text-black/45">
                  {projecting
                    ? "Read from the posting, heaviest first. Ticking one projects what closing it is worth. Scan again to score it for real."
                    : "Read from the posting, heaviest first. Scan again once you've closed them to see what they're worth."}
                </p>
              </div>
              {unmet.map((verdict) => {
                const { requirement } = verdict;
                const fixed = projecting && fixedIds.has(requirement.id);
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
                      {projecting && (
                        <StickerButton
                          variant={fixed ? "outline" : "primary"}
                          size="sm"
                          className="flex-none"
                          onClick={() => onToggleFix(requirement.id)}>
                          {fixed ? "Undo" : `+${gapLift(requirement.id)}`}
                        </StickerButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </DashCard>
          )}

          {keywordChecked && adviceCard}

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
                    {partial && coverage && coverage.total - coverage.checked > 0 && ` · ${coverage.total - coverage.checked} not checked this time`}
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
                    Solid means the scan found it in your resume. Dashed means it didn&apos;t. Only add what&apos;s honestly true of
                    your work.
                  </p>
                </div>
              )}
            </DashCard>
          )}

          {/* The call to action (owner, 2026-10-18): every fix above, sent to the editor's AI. */}
          {fixes.length > 0 && (
            <div className="flex flex-col gap-4 rounded-2xl bg-[#fbfcef] p-6 br-bold sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-primary">Fix {fixes.length === 1 ? "this" : "these"} in your resume</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-black/55">
                  Opens {resume.source === "created" ? resume.name : `an editable copy of ${resume.name}`} and has the AI make the{" "}
                  {fixes.length === 1 ? "fix" : `${fixes.length} fixes`} above in your own lines. It counts as one ask, and Undo takes it all back.
                </p>
              </div>
              <StickerButton variant="primary" size="md" className="flex-none" onClick={fixInEditor}>
                <Sparkles className="h-4 w-4" />
                Fix {fixes.length === 1 ? "it" : "these"} in my resume
              </StickerButton>
            </div>
          )}
        </>
      )}

      <DownloadModal
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        docLabel="scan report"
        fileName={reportFileName}
        onDownload={handleDownload}
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
              Suggested rewrites: your words, sharpened
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
    detail: "First scan of this file. We're parsing it so the scorer can work line by line. This only happens once.",
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
          Get more credits
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
