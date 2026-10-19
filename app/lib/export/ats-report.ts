// ATS scan report -> Markdown, DOCX and printable markup.
//
// The "Download report" button on the ATS screen used to flip to "Report
// saved" for two seconds and save nothing. It now writes the scan out — and
// only the scan: every line here is read off the one `ScanReport` the screen
// is drawing, the same way the screen reads it (the same banding, the same
// gap list, the same keyword chips, the same metric the screen drops when a
// posting could not really be compared).
//
// What is deliberately NOT in it is the screen's "+N" projection. Ticking a
// fix on screen shows what closing it might be worth; that is a what-if, not a
// measurement, and a report someone forwards or keeps should carry only the
// number the scorer produced.
//
// All three formats are rendered from one `ReportModel`, so a PDF and a Word
// file of the same scan can never disagree about what it said.

import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { STUFFING_ADVICE, coveredKeywords, isUnchecked, missingGaps, partialLine, scanCoverage, scanTier, scoreMakeup, stuffingHeadline, unmetRequirements } from "@/app/lib/ats/api";
import type { ScanReport } from "@/app/lib/ats/types";

export interface AtsReportInput {
  report: ScanReport;
  /** The document that was scored, as the screen names it. */
  resumeName: string;
  /** The posting it was scored against, or null for a general score. */
  job: { company: string; role: string } | null;
  /** When the score landed. */
  scannedAt: Date | null;
}

interface ReportGap {
  text: string;
  status: string;
  required: boolean;
  closest: string | null;
}

interface ReportModel {
  resumeName: string;
  /** "Scored against Linear · Senior Designer", or the general-score line. */
  subject: string;
  scannedAt: string | null;
  score: number;
  band: string;
  degradedNote: string | null;
  /** Each check as the report prints it: "88%", or "Not checked" when the scan could not measure it. */
  metrics: { label: string; value: string }[];
  /** How the metrics make the score, printed under them so a forwarded report adds up (owner, 2026-10-19). */
  explanation: string | null;
  gaps: ReportGap[];
  covered: string[];
  missing: string[];
  rewrites: { before: string; after: string; why: string }[];
  /** What the posting says that is not a gap: eligibility, traits, and why a resume reads as stuffed. */
  notes: string[];
  scanId: string;
}

/** The metric that needs a job description to mean anything: dropped for a general score, as the screen does. */
const KEYWORD_METRIC = "keyword-match";

const TITLE = "ATS scan report";

function modelOf({ report, resumeName, job, scannedAt }: AtsReportInput): ReportModel {
  // A scan that could check only part of the posting reads as the screen shows it (owner,
  // 2026-10-19): "Partly checked", how much, and keyword match "Not checked", never a 0 or a tier.
  const coverage = job ? scanCoverage(report) : null;
  const partial = coverage?.partial ?? false;
  // Worded by the same helper as the screen, so the two cannot drift.
  const makeup = scoreMakeup(report, { keywordChecked: Boolean(job) && !coverage?.keywordUnchecked });
  return {
    resumeName: resumeName.trim() || "Resume",
    subject: job ? `Scored against ${job.company} · ${job.role}` : "General score: how the resume reads on its own",
    scannedAt: scannedAt ? scannedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null,
    score: report.score,
    band: partial ? "Partly checked" : scanTier(report.score).label,
    degradedNote:
      partial && coverage
        ? `${partialLine(coverage)} ${makeup.partial}`
        : report.degraded
          ? (report.degradedReason ?? "Part of this scan ran on a reduced path, so treat the match as approximate.")
          : null,
    metrics: report.metrics
      .filter((m) => !(m.id === KEYWORD_METRIC && !job))
      .map((m) => ({
        label: m.label,
        value: isUnchecked(m) || m.value === null || (m.id === KEYWORD_METRIC && coverage?.keywordUnchecked) ? "Not checked" : `${m.value}%`,
      })),
    explanation: report.explanation?.trim() || null,
    gaps: unmetRequirements(report).map((verdict) => ({
      text: verdict.requirement.text,
      status: verdict.state === "missing" ? "Not found" : "Partly covered",
      required: verdict.requirement.type === "required",
      closest: verdict.evidence[0]?.text ?? null,
    })),
    covered: coveredKeywords(report).map((k) => k.label),
    missing: missingGaps(report).map((g) => g.label),
    rewrites: report.rewrites.map((r) => ({ before: r.before, after: r.after, why: r.why })),
    notes: [
      ...(report.stuffing ?? []).length > 0 ? [`${stuffingHeadline(report.stuffingPenalty)} ${(report.stuffing ?? []).join("; ")}. ${STUFFING_ADVICE}`] : [],
      ...(report.needs ?? []).map((need) => `What they need solved: ${need}.`),
      ...(report.eligibility ?? []).map((note) => `This role needs: ${note.text}. Check you meet it; it never goes on your resume and isn't in the score.`),
      ...(report.traits ?? []).map((note) => `Show in your cover letter or interview: ${note.label || note.text}.`),
    ],
    scanId: report.scanId,
  };
}

const footerOf = (m: ReportModel) =>
  `Generated by Remote Worldwide from scan ${m.scanId}. Every figure is the scan's own. Nothing on this report is projected.`;

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

/** Resume and posting text is the user's and a third party's; keep it from being read as markup. */
const md = (value: string): string => value.replace(/([\\`*_[\]|<>#])/g, "\\$1").replace(/\s+/g, " ").trim();

export function atsReportToMarkdown(input: AtsReportInput): string {
  const m = modelOf(input);
  const lines: string[] = [`# ${TITLE}`, ""];
  lines.push(`**Resume:** ${md(m.resumeName)}  `);
  lines.push(`**${md(m.subject)}**  `);
  if (m.scannedAt) lines.push(`**Scanned:** ${md(m.scannedAt)}`);
  lines.push("", `## Score: ${m.score} / 100, ${m.band}`, "");
  if (m.degradedNote) lines.push(`> ${md(m.degradedNote)}`, "");

  if (m.metrics.length > 0) {
    lines.push("## Metrics", "", "| Metric | Score |", "| --- | --- |");
    for (const metric of m.metrics) lines.push(`| ${md(metric.label)} | ${metric.value} |`);
    lines.push("");
  }

  if (m.explanation) lines.push("## What this comes down to", "", md(m.explanation), "");
  if (m.notes.length > 0) lines.push("## Notes from the posting", "", ...m.notes.map((note) => `- ${md(note)}`), "");

  if (m.gaps.length > 0) {
    lines.push(`## Gaps to close (${m.gaps.length})`, "");
    for (const gap of m.gaps) {
      lines.push(`- **${md(gap.text)}**: ${gap.status}${gap.required ? " · Required" : ""}  `);
      lines.push(gap.closest ? `  Closest line in your resume: “${md(gap.closest)}”` : "  Nothing in your resume speaks to this yet.");
    }
    lines.push("");
  }

  if (m.covered.length > 0 || m.missing.length > 0) {
    lines.push(input.job ? "## Requirements read from the job description" : "## What your resume covers", "");
    if (m.covered.length > 0) lines.push(`**Covered (${m.covered.length}):** ${m.covered.map(md).join(", ")}  `);
    if (m.missing.length > 0) lines.push(`**Missing (${m.missing.length}):** ${m.missing.map(md).join(", ")}`);
    lines.push("");
  }

  if (m.rewrites.length > 0) {
    lines.push("## Suggested rewrites", "");
    m.rewrites.forEach((r, i) => {
      lines.push(`${i + 1}. Before: ${md(r.before)}  `, `   After: **${md(r.after)}**${r.why ? "  " : ""}`);
      if (r.why) lines.push(`   _${md(r.why)}_`);
    });
    lines.push("");
  }

  lines.push("---", "", `_${md(footerOf(m))}_`, "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

const MUTED = "5A5A5A";

export async function atsReportToDocx(input: AtsReportInput): Promise<Blob> {
  const m = modelOf(input);
  const children: Paragraph[] = [];
  const heading = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 120 }, children: [new TextRun({ text, bold: true })] });
  const body = (runs: TextRun[], after = 100) => new Paragraph({ spacing: { after }, children: runs });

  children.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 160 }, children: [new TextRun({ text: TITLE, bold: true, size: 40 })] }));
  children.push(body([new TextRun({ text: "Resume: ", bold: true }), new TextRun(m.resumeName)], 40));
  children.push(body([new TextRun({ text: m.subject, bold: true })], 40));
  if (m.scannedAt) children.push(body([new TextRun({ text: "Scanned: ", bold: true }), new TextRun(m.scannedAt)], 40));

  children.push(
    new Paragraph({
      spacing: { before: 280, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "222325", space: 4 } },
      children: [new TextRun({ text: `${m.score} / 100`, bold: true, size: 48 }), new TextRun({ text: `   ${m.band}`, size: 26, color: MUTED })],
    }),
  );
  if (m.degradedNote) children.push(body([new TextRun({ text: m.degradedNote, italics: true, color: MUTED })]));

  if (m.metrics.length > 0) {
    children.push(heading("Metrics"));
    for (const metric of m.metrics) children.push(body([new TextRun({ text: `${metric.label}: `, bold: true }), new TextRun(metric.value)], 60));
  }

  if (m.explanation) {
    children.push(heading("What this comes down to"));
    children.push(body([new TextRun(m.explanation)]));
  }
  if (m.notes.length > 0) {
    children.push(heading("Notes from the posting"));
    for (const note of m.notes) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(note)] }));
  }

  if (m.gaps.length > 0) {
    children.push(heading(`Gaps to close (${m.gaps.length})`));
    for (const gap of m.gaps) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [new TextRun({ text: gap.text, bold: true }), new TextRun({ text: `: ${gap.status}${gap.required ? " · Required" : ""}`, color: MUTED })],
        }),
      );
      children.push(
        new Paragraph({
          indent: { left: 720 },
          spacing: { after: 120 },
          children: [new TextRun({ text: gap.closest ? `Closest line in your resume: “${gap.closest}”` : "Nothing in your resume speaks to this yet.", color: MUTED, size: 20 })],
        }),
      );
    }
  }

  if (m.covered.length > 0 || m.missing.length > 0) {
    children.push(heading(input.job ? "Requirements read from the job description" : "What your resume covers"));
    if (m.covered.length > 0) children.push(body([new TextRun({ text: `Covered (${m.covered.length}): `, bold: true }), new TextRun(m.covered.join(", "))]));
    if (m.missing.length > 0) children.push(body([new TextRun({ text: `Missing (${m.missing.length}): `, bold: true }), new TextRun(m.missing.join(", "))]));
  }

  if (m.rewrites.length > 0) {
    children.push(heading("Suggested rewrites"));
    for (const r of m.rewrites) {
      children.push(body([new TextRun({ text: "Before: ", bold: true }), new TextRun({ text: r.before, color: MUTED })], 40));
      children.push(body([new TextRun({ text: "After: ", bold: true }), new TextRun(r.after)], r.why ? 40 : 160));
      if (r.why) children.push(body([new TextRun({ text: r.why, italics: true, color: MUTED, size: 20 })], 160));
    }
  }

  children.push(new Paragraph({ spacing: { before: 360 }, alignment: AlignmentType.LEFT, children: [new TextRun({ text: footerOf(m), italics: true, color: MUTED, size: 18 })] }));

  const doc = new Document({
    creator: "Remote Worldwide",
    title: `${TITLE}: ${m.resumeName}`,
    styles: { default: { document: { run: { font: "Calibri", size: 22, color: "222325" } } } },
    sections: [{ properties: { page: { margin: { top: 1_200, bottom: 1_200, left: 1_200, right: 1_200 } } }, children }],
  });
  return Packer.toBlob(doc);
}

// ---------------------------------------------------------------------------
// Print (PDF through the browser's print dialog)
// ---------------------------------------------------------------------------

const esc = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A clean, text-only layout of the report for `printDocument`. Every string is
 * escaped here — resume lines and posting text reach this markup, and the print
 * frame must only ever lay them out.
 */
export function atsReportHtml(input: AtsReportInput): string {
  const m = modelOf(input);
  const parts: string[] = [];
  parts.push(`<h1>${esc(TITLE)}</h1>`);
  parts.push(
    `<p class="meta"><strong>Resume:</strong> ${esc(m.resumeName)}<br><strong>${esc(m.subject)}</strong>${m.scannedAt ? `<br><strong>Scanned:</strong> ${esc(m.scannedAt)}` : ""}</p>`,
  );
  parts.push(`<div class="score"><span class="n">${m.score}</span><span class="of">/ 100</span><span class="band">${esc(m.band)}</span></div>`);
  if (m.degradedNote) parts.push(`<p class="note">${esc(m.degradedNote)}</p>`);

  if (m.metrics.length > 0) {
    parts.push(`<h2>Metrics</h2><table>${m.metrics.map((x) => `<tr><td>${esc(x.label)}</td><td class="v">${esc(x.value)}</td></tr>`).join("")}</table>`);
  }
  if (m.explanation) parts.push(`<h2>What this comes down to</h2><p>${esc(m.explanation)}</p>`);
  if (m.notes.length > 0) parts.push(`<h2>Notes from the posting</h2><ul>${m.notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul>`);

  if (m.gaps.length > 0) {
    parts.push(
      `<h2>Gaps to close (${m.gaps.length})</h2><ul>${m.gaps
        .map(
          (g) =>
            `<li><strong>${esc(g.text)}</strong><span class="muted">: ${esc(g.status)}${g.required ? " · Required" : ""}</span><br><span class="muted small">${
              g.closest ? `Closest line in your resume: “${esc(g.closest)}”` : "Nothing in your resume speaks to this yet."
            }</span></li>`,
        )
        .join("")}</ul>`,
    );
  }

  if (m.covered.length > 0 || m.missing.length > 0) {
    parts.push(`<h2>${esc(input.job ? "Requirements read from the job description" : "What your resume covers")}</h2>`);
    if (m.covered.length > 0) parts.push(`<p><strong>Covered (${m.covered.length}):</strong> ${m.covered.map(esc).join(", ")}</p>`);
    if (m.missing.length > 0) parts.push(`<p><strong>Missing (${m.missing.length}):</strong> ${m.missing.map(esc).join(", ")}</p>`);
  }

  if (m.rewrites.length > 0) {
    parts.push(
      `<h2>Suggested rewrites</h2>${m.rewrites
        .map(
          (r) =>
            `<div class="rw"><p class="muted strike">${esc(r.before)}</p><p><strong>${esc(r.after)}</strong></p>${r.why ? `<p class="muted small">${esc(r.why)}</p>` : ""}</div>`,
        )
        .join("")}`,
    );
  }

  parts.push(`<p class="foot">${esc(footerOf(m))}</p>`);
  return `<main class="rww-report">${parts.join("")}</main>`;
}

/** Print-only CSS for `atsReportHtml`. */
export const ATS_REPORT_CSS = [
  ".rww-report{color:#222325;font-size:11pt;line-height:1.5;}",
  ".rww-report h1{font-size:20pt;margin:0 0 6pt;}",
  ".rww-report h2{font-size:12.5pt;margin:16pt 0 6pt;padding-bottom:3pt;border-bottom:1px solid #ddd;break-after:avoid;}",
  ".rww-report p{margin:0 0 6pt;}",
  ".rww-report .meta{color:#444;}",
  ".rww-report .score{display:flex;align-items:baseline;gap:8pt;margin:12pt 0 8pt;padding-bottom:8pt;border-bottom:2px solid #222325;}",
  ".rww-report .score .n{font-size:30pt;font-weight:800;}",
  ".rww-report .score .of{color:#666;}",
  ".rww-report .score .band{margin-left:auto;font-weight:700;}",
  ".rww-report .note{font-style:italic;color:#6b551a;}",
  ".rww-report table{border-collapse:collapse;width:100%;}",
  ".rww-report td{padding:3pt 0;border-bottom:1px solid #eee;}",
  ".rww-report td.v{text-align:right;font-weight:700;}",
  ".rww-report ul{margin:0;padding-left:16pt;}",
  ".rww-report li{margin:0 0 6pt;break-inside:avoid;}",
  ".rww-report .rw{margin:0 0 8pt;break-inside:avoid;}",
  ".rww-report .muted{color:#666;}",
  ".rww-report .small{font-size:9.5pt;}",
  ".rww-report .strike{text-decoration:line-through;}",
  ".rww-report .foot{margin-top:18pt;font-size:8.5pt;color:#888;}",
].join("");
