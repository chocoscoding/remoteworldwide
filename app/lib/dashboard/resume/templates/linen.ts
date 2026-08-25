// Linen — chrome "rule-frame", an elegant framed serif resume. Serif body +
// name (Source Serif 4), small-caps section headings, a burgundy accent.
// `colors.area: "border"` is what gives `RuleFrameChrome` its visible frame
// — see that component's own comment (transparent otherwise). Single
// column: `layout.columns` is left unset so it falls back to "one".

import type { ResumeTemplateDef } from "./index";
import { LinenThumb } from "./thumbs";

const linen: ResumeTemplateDef = {
  id: "linen",
  name: "Linen",
  blurb: "An elegant serif resume framed by a full-page rule border.",
  design: {
    font: { body: "source-serif-4", name: "source-serif-4" },
    headings: { style: "small-caps" },
    colors: { area: "border", accent: "#6d2434" },
  },
  sections: [
    { kind: "personal", locked: true, column: "main" },
    { kind: "summary", column: "main" },
    { kind: "experience", column: "main" },
    { kind: "education", column: "main" },
    { kind: "skills", column: "side" },
    { kind: "training", column: "side" },
    { kind: "projects", column: "main" },
  ],
  chrome: "rule-frame",
  Thumb: LinenThumb,
};

export default linen;
