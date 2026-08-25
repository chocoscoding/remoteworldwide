// Quarry — chrome "sidebar-fill". A filled pine sidebar carries skills,
// training and education, main column keeps summary/experience/projects.
// `colors.area: "full"` is what gives `SidebarFillChrome` its fill — see
// that component's own comment. `sideWidthPct: 34` is a real
// `SIDE_WIDTH_PCT_STEPS` member (28/30/32/34/36/38/40), a touch wider than
// the 32 default to give the filled column more visual weight.

import type { ResumeTemplateDef } from "./index";
import { QuarryThumb } from "./thumbs";

const quarry: ResumeTemplateDef = {
  id: "quarry",
  name: "Quarry",
  blurb: "A filled sidebar carries skills and credentials alongside the main column.",
  design: {
    layout: { columns: "two", sideWidthPct: 34 },
    colors: { area: "full", accent: "#2f5d50" },
  },
  sections: [
    { kind: "personal", locked: true, column: "main" },
    { kind: "skills", column: "side" },
    { kind: "training", column: "side" },
    { kind: "education", column: "side" },
    { kind: "summary", column: "main" },
    { kind: "experience", column: "main" },
    { kind: "projects", column: "main" },
  ],
  chrome: "sidebar-fill",
  Thumb: QuarryThumb,
};

export default quarry;
