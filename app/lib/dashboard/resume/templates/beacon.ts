// Beacon — chrome "header-block", photo-led and centered. A rust bordered
// block contains the centered header with a circular photo above it.
// `colors.area: "header"` is what gives `HeaderBlockChrome` its fill — see
// that component's own comment. Single column: `layout.columns` is left
// unset so it falls back to `DEFAULT_DESIGN.layout.columns` ("one").
// `photo.sizeMm` is left unset too — the default (28) is already a real
// `PHOTO_SIZE_MM_STEPS` member.

import type { ResumeTemplateDef } from "./index";
import { BeaconThumb } from "./thumbs";

const beacon: ResumeTemplateDef = {
  id: "beacon",
  name: "Beacon",
  blurb: "A centered photo sits inside a bordered header block, FlowCV's portrait-led look.",
  design: {
    header: { align: "center" },
    photo: { show: true, position: "above", shape: "circle" },
    colors: { area: "header", accent: "#a4522b" },
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
  chrome: "header-block",
  Thumb: BeaconThumb,
};

export default beacon;
