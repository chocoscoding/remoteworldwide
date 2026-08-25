// Template registry — the 6 gallery templates (Phase B chunk 1).
//
// Each `templates/<id>.ts` file exports one `ResumeTemplateDef`: identity
// (name/blurb), a `design` DIFF over `DEFAULT_DESIGN`, a `sections` seed
// list, its page-shell `chrome`, and a small decorative gallery-card
// `Thumb`. This module just aggregates the 6 into the two lookup shapes
// consumers need — `design-reducer.ts`'s `lookupTemplate` (id -> design +
// sections) and the gallery UI (display order + chrome + thumbnail), owned
// by a later chunk.
//
// `ResumeTemplateDef` lives here rather than in `design-types.ts` because it
// is Phase B's own shape, not one of A0's closed design enums — each
// template file imports it back with `import type`, which TypeScript erases
// entirely at compile time, so this is NOT a real runtime circular
// dependency (only `index.ts -> atlas.ts` etc. exists at runtime; the
// reverse edge never emits any JS).

import type { FC } from "react";
import type {
  ChromeId,
  DeepPartial,
  ResumeDesign,
  ResumeTemplateId,
  SectionSeed,
} from "../design-types";
import atlas from "./atlas";
import meridian from "./meridian";
import quarry from "./quarry";
import beacon from "./beacon";
import linen from "./linen";
import cadence from "./cadence";

/**
 * What one gallery template contributes. `design` is a diff — templates
 * state only what differs from `DEFAULT_DESIGN`; `design-reducer.ts`'s
 * `deepMerge` folds it in. `sections` must always start with a
 * `{ kind: "personal", locked: true }` entry: `ResumePaper` splits
 * `sections[0]` off positionally as the locked Personal Details block.
 */
export interface ResumeTemplateDef {
  id: ResumeTemplateId;
  name: string;
  blurb: string;
  design: DeepPartial<ResumeDesign>;
  sections: SectionSeed[];
  chrome: ChromeId;
  Thumb: FC<{ accent: string }>;
}

/** Keyed by id for O(1) lookup — `lookupTemplate`, gallery highlighting. */
export const TEMPLATE_REGISTRY: Record<ResumeTemplateId, ResumeTemplateDef> = {
  atlas,
  meridian,
  quarry,
  beacon,
  linen,
  cadence,
};

/** Gallery display order: atlas, meridian, quarry, beacon, linen, cadence. */
export const TEMPLATE_OPTIONS: ResumeTemplateDef[] = Object.values(TEMPLATE_REGISTRY);
