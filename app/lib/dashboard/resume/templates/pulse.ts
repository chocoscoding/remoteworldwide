// Pulse — chrome "plain", bold and a little creative: a larger Jost name over
// Open Sans body, plain headings with filled section icons, square bullets,
// skills as bubbles, and a rose accent carried onto the bullets, dates and
// contact and link icons as well as the name and headings. Two columns with a
// wider side (36). Distinct from Cadence (also plain two-column): roomier
// type, icons and colour through the body rather than compactness.

import type { ResumeTemplateDef } from "./index";
import { PulseThumb } from "./thumbs";

const pulse: ResumeTemplateDef = {
  id: "pulse",
  name: "Pulse",
  blurb: "Bold type and section icons, with colour on the bullets and dates, in two columns.",
  design: {
    layout: { columns: "two", sideWidthPct: 36 },
    fontSize: { nameOffPt: 10 },
    font: { body: "open-sans", name: "jost" },
    headings: { style: "plain", icons: "filled" },
    entries: { bulletGlyph: "square" },
    skills: { groupLayout: "bubbles" },
    colors: {
      accent: "#a13d55",
      apply: { bullets: true, dates: true, headerIcons: true, linkIcons: true },
    },
  },
  sections: [
    { kind: "personal", locked: true, column: "main" },
    { kind: "summary", column: "main" },
    { kind: "experience", column: "main" },
    { kind: "projects", column: "main" },
    { kind: "skills", column: "side" },
    { kind: "education", column: "side" },
    { kind: "training", column: "side" },
  ],
  chrome: "plain",
  Thumb: PulseThumb,
};

export default pulse;
