// Summit — chrome "header-block", a filled denim block for the header
// (`colors.area: "header"` fills `HeaderBlockChrome`), then two columns with
// skills, education and training in the narrower one (30). IBM Plex Sans,
// boxed headings, skills as bubbles. Distinct from Beacon (also header-block:
// no photo, left-aligned, two columns) and from Meridian (also two columns:
// an inset block rather than a full-bleed band, boxed headings, bubbles).
// Not "mix": the paper draws mix as plain two columns for now
// (`flattenForChrome` in ResumePaper.tsx), so it would promise a full-width
// head it doesn't print.

import type { ResumeTemplateDef } from "./index";
import { SummitThumb } from "./thumbs";

const summit: ResumeTemplateDef = {
  id: "summit",
  name: "Summit",
  blurb: "A filled header block over two columns, with boxed headings and your skills as bubbles.",
  design: {
    layout: { columns: "two", sideWidthPct: 30 },
    font: { body: "ibm-plex-sans", name: "ibm-plex-sans" },
    headings: { style: "boxed" },
    skills: { groupLayout: "bubbles" },
    colors: { area: "header", accent: "#2c5282" },
  },
  sections: [
    { kind: "personal", locked: true, column: "main" },
    { kind: "summary", column: "main" },
    { kind: "skills", column: "side" },
    { kind: "education", column: "side" },
    { kind: "training", column: "side" },
    { kind: "experience", column: "main" },
    { kind: "projects", column: "main" },
  ],
  chrome: "header-block",
  Thumb: SummitThumb,
};

export default summit;
