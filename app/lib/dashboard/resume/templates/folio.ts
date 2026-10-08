// Folio — chrome "plain", the classic serif resume for academic and research
// roles: Lora throughout, a centred header with the contact details on one
// line between bars, headings in title case under a rule (`over-rule`), a
// little more air between lines (1.4), a clay accent, and Education before
// Experience. Distinct from Linen (also serif): no frame, education first.

import type { ResumeTemplateDef } from "./index";
import { FolioThumb } from "./thumbs";

const folio: ResumeTemplateDef = {
  id: "folio",
  name: "Folio",
  blurb: "A classic serif layout with education first, for academic and research roles.",
  design: {
    font: { body: "lora", name: "lora" },
    headings: { style: "over-rule", caps: "capitalize" },
    header: { align: "center", arrange: "inline", separator: "bar" },
    spacing: { lineHeight: 1.4 },
    colors: { accent: "#8a5a2b" },
  },
  sections: [
    { kind: "personal", locked: true, column: "main" },
    { kind: "summary", column: "main" },
    { kind: "education", column: "main" },
    { kind: "experience", column: "main" },
    { kind: "projects", column: "main" },
    { kind: "training", column: "main" },
    { kind: "skills", column: "main" },
  ],
  chrome: "plain",
  Thumb: FolioThumb,
};

export default folio;
