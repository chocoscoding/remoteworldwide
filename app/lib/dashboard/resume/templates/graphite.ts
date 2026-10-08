// Graphite — chrome "plain", minimal and modern. The contact details run on
// one line between bars (`header.arrange: "inline"`), headings run into a
// rule (`rule-right`), and each entry keeps its location under the title with
// the dates alone on the right (`datePosition: "split"`). Archivo for the name
// over Work Sans body, dash bullets, a charcoal accent that also marks the
// dates. Single column.

import type { ResumeTemplateDef } from "./index";
import { GraphiteThumb } from "./thumbs";

const graphite: ResumeTemplateDef = {
  id: "graphite",
  name: "Graphite",
  blurb: "Minimal and modern: contact details on one line, headings that run into a rule.",
  design: {
    font: { body: "work-sans", name: "archivo" },
    headings: { style: "rule-right" },
    header: { arrange: "inline", separator: "bar" },
    entries: { datePosition: "split", bulletGlyph: "dash" },
    colors: { accent: "#3f4348", apply: { dates: true } },
  },
  sections: [
    { kind: "personal", locked: true, column: "main" },
    { kind: "summary", column: "main" },
    { kind: "experience", column: "main" },
    { kind: "projects", column: "main" },
    { kind: "education", column: "main" },
    { kind: "skills", column: "main" },
    { kind: "training", column: "main" },
  ],
  chrome: "plain",
  Thumb: GraphiteThumb,
};

export default graphite;
