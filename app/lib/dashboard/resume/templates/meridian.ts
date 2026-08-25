// Meridian — chrome "band-top", two-column executive look. A full-bleed navy
// header band up top (`colors.area: "header"` is what gives `BandTopChrome`
// its fill — see that component's own comment), skills/education/training
// pushed to the side column so the main column stays focused on
// summary/experience/projects.

import type { ResumeTemplateDef } from "./index";
import { MeridianThumb } from "./thumbs";

const meridian: ResumeTemplateDef = {
  id: "meridian",
  name: "Meridian",
  blurb: "A navy header band up top, with a two-column body underneath for executive resumes.",
  design: {
    layout: { columns: "two" },
    colors: { area: "header", accent: "#3a4a7a" },
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
  chrome: "band-top",
  Thumb: MeridianThumb,
};

export default meridian;
