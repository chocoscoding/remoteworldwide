// Atlas — chrome "plain", the FlowCV-standard "basic corporate" default.
//
// `design: {}` is a genuinely empty diff: Atlas simply IS `DEFAULT_DESIGN`,
// matching the intent comment on `ResumeTemplateId` in `design-types.ts`
// ("atlas -> plain, the base 'basic corporate' look").

import type { ResumeTemplateDef } from "./index";
import { AtlasThumb } from "./thumbs";

const atlas: ResumeTemplateDef = {
  id: "atlas",
  name: "Atlas",
  blurb: "The FlowCV-standard basic corporate default.",
  design: {},
  sections: [
    { kind: "personal", locked: true, column: "main" },
    { kind: "summary", column: "main" },
    { kind: "experience", column: "main" },
    { kind: "education", column: "main" },
    { kind: "skills", column: "main" },
    { kind: "training", column: "main" },
    { kind: "projects", column: "main" },
  ],
  chrome: "plain",
  Thumb: AtlasThumb,
};

export default atlas;
