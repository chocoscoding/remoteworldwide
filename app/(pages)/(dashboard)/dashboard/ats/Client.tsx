"use client";

import { FC, useState } from "react";
import { Briefcase, Check, ChevronDown, ClipboardPaste, Download, FilePlus, Link2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar, { type ProgressBarFillColor } from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import { APPS, ATS_FIX_ITEMS, ATS_KEYWORDS, ATS_METRICS, ATS_RESUMES, ATS_SCORE } from "@/app/lib/dashboard/mock-data";
import type { AtsResumeRow } from "@/app/lib/dashboard/types";

// ---------------------------------------------------------------------------
// Local screen state types + config — not shared with any other screen.
// ---------------------------------------------------------------------------

type AtsMode = "one" | "jd" | "all";
type JdInputMode = "link" | "paste" | "saved";

const ATS_MODES: { id: AtsMode; label: string }[] = [
  { id: "one", label: "General score" },
  { id: "jd", label: "Against a job" },
  { id: "all", label: "All my resumes" },
];

const JD_INPUT_MODES: { id: JdInputMode; label: string; icon: typeof Link2 }[] = [
  { id: "link", label: "Paste a link", icon: Link2 },
  { id: "paste", label: "Paste text", icon: ClipboardPaste },
  { id: "saved", label: "Pick a saved job", icon: Briefcase },
];

function getScoreTier(score: number): { label: string; variant: "positive" | "neutral" | "urgent" } {
  if (score >= 85) return { label: "Strong match", variant: "positive" };
  if (score >= 65) return { label: "Good, not yet great", variant: "neutral" };
  return { label: "Needs work", variant: "urgent" };
}

function metricFill(value: number): ProgressBarFillColor {
  return value >= 85 ? "#e1f073" : "#cddd54";
}

const AtsClient: FC = () => {
  const [atsMode, setAtsMode] = useState<AtsMode>("one");

  // "Against a job" toolbar state
  const [jdInputMode, setJdInputMode] = useState<JdInputMode>("saved");
  const [jdLink, setJdLink] = useState("");
  const [jdPaste, setJdPaste] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>("app-vercel");
  const [scoringResume, setScoringResume] = useState("Master resume");
  const [scoringMenuOpen, setScoringMenuOpen] = useState(false);
  // Whether a JD has actually been linked/pasted/picked yet — "Against a job"
  // starts empty until the user submits the toolbar above (or hits the demo
  // shortcut), rather than always showing the fully-scored mock content.
  const [jdLinked, setJdLinked] = useState(false);

  // Score-detail interactivity
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [queuedKeywordIds, setQueuedKeywordIds] = useState<Set<string>>(new Set());
  const [reportDownloaded, setReportDownloaded] = useState(false);
  // Keywords are reference detail, not a primary action — collapsed until asked for.
  const [keywordsOpen, setKeywordsOpen] = useState(false);

  // "All my resumes" table
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  const scoreTier = getScoreTier(ATS_SCORE);

  const selectedJob = APPS.find((a) => a.id === selectedJobId);
  const selectedJobLabel = selectedJob ? `${selectedJob.meta.split(" · ")[0]} — ${selectedJob.title}` : null;

  const presentKeywordCount = ATS_KEYWORDS.filter((kw) => kw.present || queuedKeywordIds.has(kw.id)).length;
  const missingKeywordCount = ATS_KEYWORDS.length - presentKeywordCount;

  const toggleFix = (id: string) => {
    setFixedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const toggleQueuedKeyword = (id: string) => {
    setQueuedKeywordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadReport = () => {
    setReportDownloaded(true);
    window.setTimeout(() => setReportDownloaded(false), 2000);
  };

  // Submitting any of the JD-input toolbar's paths (link, paste, or picking a
  // saved job) — or the empty state's "Try an example" shortcut — all lead to
  // the same populated view. No real JD parsing here, just a state flip.
  const handleJdSubmit = () => {
    setJdLinked(true);
  };

  const handleRowAction = (row: AtsResumeRow) => {
    if (archivedIds.has(row.id)) return;
    if (row.action === "Improve") {
      setAtsMode("one");
      return;
    }
    if (row.action === "Open") {
      setScoringResume(row.name);
      setAtsMode("jd");
      setJdLinked(true);
      return;
    }
    if (row.action === "Archive") {
      setArchivedIds((prev) => {
        const next = new Set(prev);
        next.add(row.id);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <h1 className="text-[17px] font-bold text-primary whitespace-nowrap flex-none">ATS scorer</h1>

        <div className="flex items-center gap-3 flex-none">
          <div className="inline-flex items-center gap-0.5 rounded-full bg-[#f0f0ea] p-1">
            {ATS_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setAtsMode(m.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                  atsMode === m.id ? "bg-[#222325] text-white" : "text-black/55 hover:text-primary"
                )}>
                {m.label}
              </button>
            ))}
          </div>

          <StickerButton variant="primary" size="md" onClick={() => {}}>
            <FilePlus className="h-4 w-4" />
            Score another resume
          </StickerButton>
        </div>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1100px] mx-auto">
        {/* "Against a job" JD-input toolbar */}
        {atsMode === "jd" && (
          <DashCard className="p-5 mb-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="inline-flex items-center gap-0.5 rounded-full bg-[#f0f0ea] p-1">
                {JD_INPUT_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setJdInputMode(m.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      jdInputMode === m.id ? "bg-white text-primary shadow-sm" : "text-black/50 hover:text-primary"
                    )}>
                    <m.icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setScoringMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/12 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:border-black/25 transition-colors cursor-pointer">
                  Scoring: {scoringResume}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", scoringMenuOpen && "rotate-180")} />
                </button>

                {scoringMenuOpen && (
                  <>
                    <button
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setScoringMenuOpen(false)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-20 w-60 rounded-xl border border-black/10 bg-white shadow-lg p-1.5">
                      {ATS_RESUMES.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setScoringResume(r.name);
                            setScoringMenuOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left cursor-pointer hover:bg-[#f6f6f6] transition-colors",
                            scoringResume === r.name ? "font-bold text-primary" : "font-medium text-black/70"
                          )}>
                          <span className="truncate">{r.name}</span>
                          {scoringResume === r.name && <Check className="h-3.5 w-3.5 flex-none" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {jdInputMode === "link" && (
              <div className="flex gap-2.5">
                <input
                  value={jdLink}
                  onChange={(e) => setJdLink(e.target.value)}
                  placeholder="Paste a job posting URL…"
                  className="flex-1 h-10 rounded-lg border border-black/12 bg-[#fbfbf7] px-3.5 text-sm text-primary placeholder:text-black/35 focus:outline-none focus:border-black/30 transition-colors"
                />
                <StickerButton variant="primary" size="md" onClick={handleJdSubmit} className="flex-none">
                  Score against this
                </StickerButton>
              </div>
            )}

            {jdInputMode === "paste" && (
              <div className="flex flex-col gap-2.5">
                <textarea
                  value={jdPaste}
                  onChange={(e) => setJdPaste(e.target.value)}
                  rows={3}
                  placeholder="Paste the full job description text…"
                  className="w-full rounded-lg border border-black/12 bg-[#fbfbf7] px-3.5 py-2.5 text-sm text-primary placeholder:text-black/35 focus:outline-none focus:border-black/30 transition-colors resize-none"
                />
                <StickerButton variant="primary" size="md" className="self-start" onClick={handleJdSubmit}>
                  Score against this
                </StickerButton>
              </div>
            )}

            {jdInputMode === "saved" && (
              <div className="flex flex-wrap gap-2">
                {APPS.map((app) => {
                  const company = app.meta.split(" · ")[0];
                  const selected = selectedJobId === app.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        setSelectedJobId(app.id);
                        handleJdSubmit();
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                        selected ? "bg-primary text-white border-primary" : "bg-white text-black/65 border-black/12 hover:border-black/30"
                      )}>
                      {selected && <Check className="h-3 w-3" />}
                      {company} — {app.title}
                    </button>
                  );
                })}
              </div>
            )}
          </DashCard>
        )}

        {/* "Against a job" empty state — no JD linked yet */}
        {atsMode === "jd" && !jdLinked && (
          <DashCard className="p-14 flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#f0f0ea] flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-black/35" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-primary mb-1.5">Link a job to see your match score</p>
              <p className="text-sm text-black/50 max-w-sm mx-auto leading-relaxed">
                Paste a job posting link, paste the description text, or pick a saved job above — we&apos;ll score{" "}
                {scoringResume} against it and show you exactly what to fix.
              </p>
            </div>
            <StickerButton variant="outline" size="md" onClick={handleJdSubmit} className="mt-1">
              <Sparkles className="h-4 w-4" />
              Try an example
            </StickerButton>
          </DashCard>
        )}

        {/* Score detail (General score + Against a job share the same layout) */}
        {(atsMode === "one" || (atsMode === "jd" && jdLinked)) && (
          <>
            <DashCard className="p-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-black/35 mb-5">
                {atsMode === "jd" ? (selectedJobLabel ? `Scored against ${selectedJobLabel}` : "Pick a job above to score against it") : "General ATS score"}
              </p>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
                <div
                  className="relative h-[164px] w-[164px] flex-none rounded-full"
                  style={{ background: `conic-gradient(#e1f073 0% ${ATS_SCORE}%, #f0f0ea ${ATS_SCORE}% 100%)` }}>
                  <div className="absolute inset-[12px] rounded-full bg-white flex flex-col items-center justify-center">
                    <span className="text-[38px] font-bold text-primary leading-none">{ATS_SCORE}</span>
                    <span className="text-[11px] font-medium text-black/40 mt-1">out of 100</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-4 text-center sm:text-left items-center sm:items-start">
                  <div>
                    <Pill variant={scoreTier.variant} className="mb-2.5">
                      {scoreTier.label}
                    </Pill>
                    <p className="text-[15px] text-black/70 leading-relaxed max-w-md">
                      {atsMode === "jd"
                        ? "Solid match for this kind of role — closing the gaps below would push you past most applicant-tracking cutoffs."
                        : "Solid, broadly employable resume. A few targeted fixes would push you into strong-match territory."}
                    </p>
                  </div>
                  <StickerButton variant="outline" size="md" onClick={handleDownloadReport}>
                    <Download className="h-4 w-4" />
                    {reportDownloaded ? "Downloaded ✓" : "Download report"}
                  </StickerButton>
                </div>
              </div>
            </DashCard>

            {/* 4-tile metric row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {ATS_METRICS.map((m) => (
                <DashCard key={m.id} className="flex flex-col gap-2.5">
                  <p className="text-[11.5px] font-medium text-black/50">{m.label}</p>
                  <p className="text-2xl font-bold text-primary leading-none">{m.value}%</p>
                  <ProgressBar value={m.value} fillColor={metricFill(m.value)} height="h-1.5" />
                </DashCard>
              ))}
            </div>

            {/* Fix these three — the primary action card, full width */}
            <DashCard className="p-6 mt-5">
              <p className="text-[15px] font-bold text-primary mb-1">Fix these three</p>
              <p className="text-xs text-black/45 mb-4">Highest-impact changes, ranked by how much they move your score.</p>
              <div className="flex flex-col divide-y divide-black/8">
                {ATS_FIX_ITEMS.map((item) => {
                  const isFixed = fixedIds.has(item.id);
                  return (
                    <div key={item.id} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
                      <span
                        className={cn(
                          "h-6 w-6 flex-none rounded-full flex items-center justify-center mt-0.5",
                          isFixed ? "bg-secondary" : "bg-[#f0f0ea]"
                        )}>
                        {isFixed ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="h-1.5 w-1.5 rounded-full bg-black/30" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-semibold", isFixed ? "text-black/35 line-through" : "text-primary")}>{item.label}</p>
                        <p className={cn("text-xs mt-0.5 leading-relaxed", isFixed ? "text-black/25" : "text-black/45")}>{item.detail}</p>
                      </div>
                      <StickerButton
                        variant="outline"
                        size="sm"
                        className="flex-none"
                        disabled={isFixed}
                        onClick={() => toggleFix(item.id)}>
                        {isFixed ? "Fixed" : item.action}
                      </StickerButton>
                    </div>
                  );
                })}
              </div>
            </DashCard>

            {/* Keywords — reference detail, collapsed until asked for so it doesn't compete with the fix list above */}
            <DashCard className="p-0 mt-5 overflow-hidden">
              <button
                type="button"
                onClick={() => setKeywordsOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left cursor-pointer hover:bg-[#fbfbf7] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">Keywords from the job description</p>
                  <p className="text-xs text-black/45 mt-0.5">
                    {presentKeywordCount} present · {missingKeywordCount} missing
                    {queuedKeywordIds.size > 0 ? ` · ${queuedKeywordIds.size} queued` : ""}
                  </p>
                </div>
                <ChevronDown className={cn("h-4 w-4 flex-none text-black/40 transition-transform", keywordsOpen && "rotate-180")} />
              </button>

              {keywordsOpen && (
                <div className="px-6 pb-6 pt-4 border-t border-black/8">
                  <p className="text-xs text-black/45 mb-3">Solid = already in your resume · dashed = missing, click to queue it in.</p>
                  <div className="flex flex-wrap gap-2">
                    {ATS_KEYWORDS.map((kw) => {
                      const queued = queuedKeywordIds.has(kw.id);
                      const present = kw.present || queued;
                      return (
                        <Pill
                          key={kw.id}
                          variant={present ? "positive" : "outline-dashed"}
                          role={kw.present ? undefined : "button"}
                          tabIndex={kw.present ? undefined : 0}
                          onClick={() => !kw.present && toggleQueuedKeyword(kw.id)}
                          className={cn("gap-1", !kw.present && "cursor-pointer hover:border-black/40 hover:text-black/70 transition-colors")}>
                          {present && <Check className="h-3 w-3" />}
                          {kw.label}
                        </Pill>
                      );
                    })}
                  </div>
                </div>
              )}
            </DashCard>
          </>
        )}

        {/* "All my resumes" table */}
        {atsMode === "all" && (
          <DashCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[1fr_140px_150px_120px] items-center gap-4 px-6 py-3 border-b border-black/8 bg-[#fbfbf7]">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-black/40">Resume</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-black/40">General score</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-black/40">Against a job</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-black/40 text-right">Action</span>
                </div>
                <div className="flex flex-col divide-y divide-black/8">
                  {ATS_RESUMES.map((row) => {
                    const isArchived = row.archived || archivedIds.has(row.id);
                    const isFreshlyArchived = archivedIds.has(row.id);
                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "grid grid-cols-[1fr_140px_150px_120px] items-center gap-4 px-6 py-4 transition-opacity",
                          isArchived && "opacity-45"
                        )}>
                        <span className="text-sm font-semibold text-primary truncate">{row.name}</span>
                        <span className="text-sm font-bold text-primary tabular-nums">{row.generalScore ?? "—"}</span>
                        <span className="text-sm font-bold text-primary tabular-nums">{row.jdScore ?? "—"}</span>
                        <div className="flex justify-end">
                          <StickerButton
                            variant="outline"
                            size="sm"
                            disabled={isFreshlyArchived}
                            onClick={() => handleRowAction(row)}>
                            {isFreshlyArchived ? "Archived" : row.action}
                          </StickerButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </DashCard>
        )}
      </main>
    </div>
  );
};

export default AtsClient;
