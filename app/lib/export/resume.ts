// Resume -> DOCX and Markdown, from the document's structured content.
//
// A Word file is built from what the resume SAYS — sections in the order and
// visibility the user set, their fonts, accent colour, text size and page — not
// from a screenshot of it. That keeps it editable and ATS-readable. It is laid
// out in one column even when the design uses two: a Word table imitating a
// sidebar is exactly what trips parsers, and the PDF export (the browser's
// print of the real paper) is the one that keeps the exact look.

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  type ParagraphChild,
} from "docx";
import { FONT_REGISTRY } from "@/app/lib/dashboard/resume/fonts";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import type { ResumeContent } from "@/app/lib/dashboard/types";

const TWIPS_PER_MM = 56.6929;

/** Page sizes in twips (1/1440 inch). */
const PAGE: Record<ResumeDesign["doc"]["pageFormat"], { width: number; height: number }> = {
  letter: { width: 12_240, height: 15_840 },
  a4: { width: 11_906, height: 16_838 },
};

const GLYPH: Record<ResumeDesign["entries"]["bulletGlyph"], string | null> = { dot: "•", dash: "–", square: "▪", none: null };

/** "#3A4A7A" -> "3A4A7A", or the fallback when the design holds something Word cannot read. */
const hex = (value: string | undefined, fallback: string): string => {
  const match = /^#?([0-9a-f]{6})$/i.exec(value ?? "");
  return match ? match[1].toUpperCase() : fallback;
};

const fontName = (id: string): string => FONT_REGISTRY[id as keyof typeof FONT_REGISTRY]?.label ?? "Calibri";

const clean = (value: string | undefined | null): string => (value ?? "").trim();

/** Contact parts shown under the name: whatever the user filled in, in the order a reader looks for it. */
function contactParts(content: ResumeContent): { text: string; link?: string }[] {
  const parts: { text: string; link?: string }[] = [];
  if (clean(content.email)) parts.push({ text: clean(content.email), link: `mailto:${clean(content.email)}` });
  if (clean(content.phone)) parts.push({ text: clean(content.phone) });
  if (clean(content.location)) parts.push({ text: clean(content.location) });
  if (clean(content.portfolio)) parts.push({ text: clean(content.portfolio), link: /^https?:\/\//i.test(content.portfolio) ? content.portfolio : undefined });
  for (const link of content.links ?? []) {
    const url = clean(link.url);
    if (!url) continue;
    parts.push({ text: clean(link.label) || url, link: /^https?:\/\//i.test(url) ? url : undefined });
  }
  return parts;
}

/** The sections to write, in the user's order: visible ones, minus the header (written first) and blanks. */
const bodySections = (sections: SectionConfig[]) => sections.filter((s) => s.visible && s.kind !== "personal");

export async function resumeToDocx(content: ResumeContent, design: ResumeDesign, sections: SectionConfig[]): Promise<Blob> {
  const accent = hex(design.colors.accent, "222325");
  const text = hex(design.colors.text, "222325");
  const muted = hex(design.colors.textMuted, "5A5A5A");
  const base = Math.round((design.fontSize.basePt || 10.5) * 2);
  const size = (offsetPt: number) => Math.max(12, Math.round(base + offsetPt * 2));
  const glyph = GLYPH[design.entries.bulletGlyph] ?? "•";
  const showDates = design.entries.showDates !== false;
  const page = PAGE[design.doc.pageFormat] ?? PAGE.letter;
  const marginX = Math.round((design.spacing.marginXmm || 16) * TWIPS_PER_MM);
  const marginY = Math.round((design.spacing.marginYmm || 14) * TWIPS_PER_MM);
  const textWidth = page.width - marginX * 2;
  const caps = design.headings.caps === "uppercase";

  const heading = (label: string) =>
    new Paragraph({
      spacing: { before: 240, after: 100 },
      keepNext: true,
      border: { bottom: { color: accent, space: 2, style: BorderStyle.SINGLE, size: 6 } },
      children: [new TextRun({ text: label, bold: true, color: accent, allCaps: caps, size: size(design.fontSize.headingOffPt) })],
    });

  /** A title on the left and, when shown, dates tabbed to the right margin. */
  const entryLine = (title: ParagraphChild[], dates: string) =>
    new Paragraph({
      keepNext: true,
      spacing: { before: 120, after: 20 },
      tabStops: [{ type: TabStopType.RIGHT, position: textWidth }],
      children: showDates && clean(dates) ? [...title, new TextRun({ text: `\t${clean(dates)}`, color: muted })] : title,
    });

  const bullet = (line: string) =>
    glyph
      ? new Paragraph({ numbering: { reference: "resume-bullets", level: 0 }, spacing: { after: 30 }, children: [new TextRun(line)] })
      : new Paragraph({ spacing: { after: 30 }, children: [new TextRun(line)] });

  const children: Paragraph[] = [];

  // Header
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: clean(content.name) || "Your name", bold: true, size: size(design.fontSize.nameOffPt), font: fontName(design.font.name) })],
    }),
  );
  if (clean(content.title)) {
    children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: clean(content.title), color: accent, size: size(design.fontSize.titleOffPt) })] }));
  }
  const contacts = contactParts(content);
  if (contacts.length > 0) {
    const runs: ParagraphChild[] = [];
    contacts.forEach((part, i) => {
      if (i > 0) runs.push(new TextRun({ text: "  ·  ", color: muted }));
      runs.push(part.link ? new ExternalHyperlink({ link: part.link, children: [new TextRun({ text: part.text, color: muted })] }) : new TextRun({ text: part.text, color: muted }));
    });
    children.push(new Paragraph({ spacing: { after: 120 }, children: runs }));
  }

  for (const section of bodySections(sections)) {
    switch (section.kind) {
      case "page-break":
        children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
        break;
      case "summary":
        if (!clean(content.summary)) break;
        children.push(heading(section.label), new Paragraph({ spacing: { after: 60 }, children: [new TextRun(clean(content.summary))] }));
        break;
      case "experience": {
        const entries = content.experience.filter((e) => clean(e.role) || clean(e.company) || e.bullets.some((b) => clean(b)));
        if (entries.length === 0) break;
        children.push(heading(section.label));
        for (const entry of entries) {
          const title: ParagraphChild[] = [new TextRun({ text: clean(entry.role), bold: true })];
          if (clean(entry.company)) title.push(new TextRun({ text: `${clean(entry.role) ? " — " : ""}${clean(entry.company)}` }));
          children.push(entryLine(title, entry.dates));
          entry.bullets.filter((b) => clean(b)).forEach((b) => children.push(bullet(clean(b))));
        }
        break;
      }
      case "education": {
        const entries = content.education.filter((e) => clean(e.school) || clean(e.degree));
        if (entries.length === 0) break;
        children.push(heading(section.label));
        for (const entry of entries) {
          const title: ParagraphChild[] = [new TextRun({ text: clean(entry.school), bold: true })];
          if (clean(entry.degree)) title.push(new TextRun({ text: `${clean(entry.school) ? " — " : ""}${clean(entry.degree)}` }));
          children.push(entryLine(title, entry.dates));
          const extra = [clean(entry.location), clean(entry.detail)].filter(Boolean).join(" · ");
          if (extra) children.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: extra, color: muted })] }));
        }
        break;
      }
      case "skills":
        if (content.skills.filter((s) => clean(s)).length === 0) break;
        children.push(heading(section.label), new Paragraph({ children: [new TextRun(content.skills.map(clean).filter(Boolean).join("  ·  "))] }));
        break;
      case "projects": {
        const entries = content.projects.filter((p) => clean(p.name) || clean(p.detail));
        if (entries.length === 0) break;
        children.push(heading(section.label));
        for (const project of entries) {
          const title: ParagraphChild[] = [new TextRun({ text: clean(project.name), bold: true })];
          const link = clean(project.link);
          if (link && /^https?:\/\//i.test(link)) title.push(new TextRun("  "), new ExternalHyperlink({ link, children: [new TextRun({ text: link, color: accent })] }));
          children.push(new Paragraph({ keepNext: true, spacing: { before: 120, after: 20 }, children: title }));
          if (clean(project.detail)) children.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun(clean(project.detail))] }));
        }
        break;
      }
      case "training": {
        const entries = content.certifications.filter((c) => clean(c.name));
        if (entries.length === 0) break;
        children.push(heading(section.label));
        for (const cert of entries) {
          const detail = [clean(cert.issuer), clean(cert.year)].filter(Boolean).join(", ");
          children.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: clean(cert.name), bold: true }), ...(detail ? [new TextRun({ text: ` — ${detail}`, color: muted })] : [])],
            }),
          );
        }
        break;
      }
      // "custom" sections have no content model yet, so there is nothing to write.
      default:
        break;
    }
  }

  const doc = new Document({
    creator: clean(content.name) || "Remote Worldwide",
    title: `${clean(content.name) || "Resume"}${clean(content.title) ? ` — ${clean(content.title)}` : ""}`,
    styles: {
      default: {
        document: {
          run: { font: fontName(design.font.body), size: base, color: text },
          paragraph: { spacing: { line: Math.round(240 * Math.min(Math.max(design.spacing.lineHeight || 1.25, 1), 2)) } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "resume-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: glyph ?? "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: page, margin: { top: marginY, bottom: marginY, left: marginX, right: marginX } } },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

/** The same content as Markdown: headings, bullets and links, nothing a plain-text reader cannot follow. */
export function resumeToMarkdown(content: ResumeContent, sections: SectionConfig[]): string {
  const lines: string[] = [`# ${clean(content.name) || "Your name"}`];
  if (clean(content.title)) lines.push("", clean(content.title));
  const contacts = contactParts(content).map((part) => (part.link && !part.link.startsWith("mailto:") ? `[${part.text}](${part.link})` : part.text));
  if (contacts.length > 0) lines.push("", contacts.join(" · "));

  for (const section of bodySections(sections)) {
    const block: string[] = [];
    switch (section.kind) {
      case "summary":
        if (clean(content.summary)) block.push(clean(content.summary));
        break;
      case "experience":
        for (const e of content.experience) {
          if (!clean(e.role) && !clean(e.company)) continue;
          block.push(`### ${[clean(e.role), clean(e.company)].filter(Boolean).join(" — ")}${clean(e.dates) ? ` (${clean(e.dates)})` : ""}`);
          e.bullets.filter((b) => clean(b)).forEach((b) => block.push(`- ${clean(b)}`));
          block.push("");
        }
        break;
      case "education":
        for (const e of content.education) {
          if (!clean(e.school) && !clean(e.degree)) continue;
          block.push(`### ${[clean(e.school), clean(e.degree)].filter(Boolean).join(" — ")}${clean(e.dates) ? ` (${clean(e.dates)})` : ""}`);
          const extra = [clean(e.location), clean(e.detail)].filter(Boolean).join(" · ");
          if (extra) block.push(extra);
          block.push("");
        }
        break;
      case "skills":
        if (content.skills.some((s) => clean(s))) block.push(content.skills.map(clean).filter(Boolean).join(" · "));
        break;
      case "projects":
        for (const p of content.projects) {
          if (!clean(p.name) && !clean(p.detail)) continue;
          block.push(`### ${clean(p.name)}${clean(p.link) ? ` — ${clean(p.link)}` : ""}`);
          if (clean(p.detail)) block.push(clean(p.detail));
          block.push("");
        }
        break;
      case "training":
        for (const c of content.certifications) {
          if (!clean(c.name)) continue;
          const detail = [clean(c.issuer), clean(c.year)].filter(Boolean).join(", ");
          block.push(`- ${clean(c.name)}${detail ? ` — ${detail}` : ""}`);
        }
        break;
      default:
        break;
    }
    const body = block.join("\n").trim();
    if (body) lines.push("", `## ${section.label}`, "", body);
  }
  return `${lines.join("\n")}\n`;
}
