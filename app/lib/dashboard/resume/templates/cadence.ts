// Cadence — chrome "plain", dense two-column. Distinct from Meridian despite
// both being two-column: no colored band (plain chrome), tighter type and
// spacing instead — the "compact/dense" archetype for detail-rich resumes.
// Every numeric value below is a literal member of its matching step table
// in `design-defaults.ts`: 10 in `BASE_PT_STEPS`, 6 in `ELEMENT_GAP_STEPS`,
// 12 in `MARGIN_MM_STEPS`, 1.2 in `LINE_HEIGHT_STEPS`.

import type { ResumeTemplateDef } from "./index";
import { CadenceThumb } from "./thumbs";

const cadence: ResumeTemplateDef = {
  id: "cadence",
  name: "Cadence",
  blurb: "A tight two-column layout with compact type, built for detail-rich resumes.",
  design: {
    layout: { columns: "two" },
    fontSize: { basePt: 10 },
    spacing: { elementGapPt: 6, marginXmm: 12, marginYmm: 12, lineHeight: 1.2 },
    colors: { accent: "#2b6cb0" },
  },
  sections: [
    { kind: "personal", locked: true, column: "main" },
    { kind: "summary", column: "main" },
    { kind: "experience", column: "main" },
    { kind: "projects", column: "main" },
    { kind: "education", column: "side" },
    { kind: "skills", column: "side" },
    { kind: "training", column: "side" },
  ],
  chrome: "plain",
  Thumb: CadenceThumb,
};

export default cadence;
