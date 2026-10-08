// Harbor — chrome "band-top", single column with a photo. The teal band
// (`colors.area: "header"` is what fills `BandTopChrome`) carries a rounded
// photo to the left of the name with the contact details on one line under it
// (`arrange: "inline"`, so the band stays shallow), and one clean column runs
// below it. Rubik throughout, headings in title case with a short accent
// underline. Distinct from Meridian (also band-top): one column and a photo,
// not two columns.

import type { ResumeTemplateDef } from "./index";
import { HarborThumb } from "./thumbs";

const harbor: ResumeTemplateDef = {
  id: "harbor",
  name: "Harbor",
  blurb: "A teal header band with your photo beside your name, over one clean column.",
  design: {
    font: { body: "rubik", name: "rubik" },
    headings: { style: "accent-underline", caps: "capitalize" },
    header: { arrange: "inline", separator: "bullet" },
    photo: { show: true, position: "left", shape: "rounded", sizeMm: 26 },
    colors: { area: "header", accent: "#14706b" },
  },
  sections: [
    { kind: "personal", locked: true, column: "main" },
    { kind: "summary", column: "main" },
    { kind: "experience", column: "main" },
    { kind: "education", column: "main" },
    { kind: "skills", column: "main" },
    { kind: "projects", column: "main" },
    { kind: "training", column: "main" },
  ],
  chrome: "band-top",
  Thumb: HarborThumb,
};

export default harbor;
