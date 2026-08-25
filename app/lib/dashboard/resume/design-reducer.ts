// Design state: a snapshot reducer wrapped in an undo/redo history reducer.
//
// -- Why snapshots, not patches -------------------------------------------
// `template/apply` becomes ONE undoable step that restores all prior
// customisation on undo (real FlowCV behaviour, free). `sections` shares the
// history with `design` because reordering a section is a design decision.
// Content edits stay out of this reducer entirely.
//
// -- Undo granularity is COMMIT-based, not time-debounced ------------------
// Radix Slider exposes `onValueCommit` alongside `onValueChange`:
//   onValueChange -> dispatch with `transient: true`  -> replaces `present`
//   onValueCommit -> dispatch with `transient: false` -> pushes onto `past`
// A 12-step drag is therefore exactly one undo entry by construction. No
// timers and no `Date.now()` — `react-hooks/purity` forbids both here. Controls
// with no commit event (hex field, colour wheel) debounce at the COMPONENT
// level and dispatch a single non-transient action on settle.
//
// -- The identity guard ----------------------------------------------------
// `snapshotReducer` returns the IDENTICAL object reference when nothing
// actually changed (a slider re-firing the same value, a checkbox set to what
// it already was). That one guard keeps no-ops out of the history and out of
// the render path.

import {
  DEFAULT_DESIGN,
  DEFAULT_SECTIONS,
  DEFAULT_SECTION_LABELS,
  sectionsFromSeeds,
} from "./design-defaults";
import type {
  AccentTarget,
  BulletGlyph,
  CapsMode,
  ChromeId,
  ColorArea,
  ColorMode,
  ColumnSlot,
  ColumnsMode,
  DatePosition,
  DateFormatId,
  DeepPartial,
  EntryStructure,
  FontId,
  FontSizeOffsetKey,
  HeaderArrange,
  HeadingStyleId,
  IconMode,
  IconSetId,
  LinkStyle,
  NeutralColorKey,
  PageFormat,
  PhotoPosition,
  PhotoShape,
  ResumeDesign,
  ResumeTemplateId,
  SectionConfig,
  SectionSeed,
  SeparatorMode,
  SubtitlePlace,
  TextAlign,
} from "./design-types";
import { TEMPLATE_REGISTRY } from "./templates";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface DesignSnapshot {
  design: ResumeDesign;
  sections: SectionConfig[];
}

export interface HistoryState {
  past: DesignSnapshot[];
  present: DesignSnapshot;
  future: DesignSnapshot[];
  /**
   * The snapshot captured at the START of the current transient run (i.e. the
   * value the document had when a slider drag began), or null when no drag is
   * in flight.
   *
   * This exists because the naive {past, present, future} version silently
   * loses the whole interaction: a drag pushes nothing (every action is
   * transient), and then the commit dispatches the SAME final value, which the
   * identity guard turns into a no-op — so the drag ends up with zero undo
   * entries rather than one. Stashing the pre-drag snapshot here and pushing
   * THAT on commit is what actually delivers "12-step drag = one undo entry".
   */
  pending: DesignSnapshot | null;
}

const HISTORY_LIMIT = 50;

// ---------------------------------------------------------------------------
// Actions — one per control in the Customize panels
// ---------------------------------------------------------------------------

export type DesignAction =
  // Document
  | { type: "doc/setLanguage"; value: string }
  | { type: "doc/setDateFormat"; id: DateFormatId }
  | { type: "doc/setPageFormat"; format: PageFormat }
  // Templates
  | { type: "template/apply"; id: ResumeTemplateId }
  // Layout
  | { type: "layout/setColumns"; columns: ColumnsMode }
  | { type: "layout/setSideWidth"; pct: number; transient?: boolean }
  // Layout > Change Section Layout
  | { type: "sections/reorder"; from: number; to: number }
  | { type: "sections/setColumn"; id: string; column: ColumnSlot }
  | { type: "sections/toggle"; id: string }
  | { type: "sections/rename"; id: string; label: string }
  /** `id` is supplied by the caller — the reducer may not invent one. */
  | { type: "sections/addPageBreak"; id: string; index?: number }
  | { type: "sections/remove"; id: string }
  // Font Size
  | { type: "fontSize/setBase"; pt: number; transient?: boolean }
  | { type: "fontSize/setOffset"; key: FontSizeOffsetKey; pt: number; transient?: boolean }
  // Spacing
  | { type: "spacing/set"; key: keyof ResumeDesign["spacing"]; value: number; transient?: boolean }
  // Entries
  | { type: "entries/setStructure"; structure: EntryStructure }
  | { type: "entries/setDatePosition"; position: DatePosition }
  | { type: "entries/setSubtitle"; place: SubtitlePlace }
  | { type: "entries/toggleDates" }
  | { type: "entries/toggleLocation" }
  | { type: "entries/setBulletGlyph"; glyph: BulletGlyph }
  | { type: "entries/toggleIndentBullets" }
  // Headings
  | { type: "headings/setStyle"; id: HeadingStyleId }
  | { type: "headings/setCaps"; caps: CapsMode }
  | { type: "headings/setIcons"; icons: IconMode }
  // Font
  | { type: "font/set"; slot: "body" | "name"; id: FontId }
  // Colors
  | { type: "colors/setArea"; area: ColorArea }
  | { type: "colors/setMode"; mode: ColorMode }
  | { type: "colors/setAccent"; hex: string; transient?: boolean }
  | { type: "colors/setAccentSlot"; slot: 2 | 3; hex: string; transient?: boolean }
  | { type: "colors/setNeutral"; key: NeutralColorKey; hex: string; transient?: boolean }
  | { type: "colors/toggleTarget"; target: AccentTarget }
  // Header
  | { type: "header/setAlign"; align: TextAlign }
  | { type: "header/setArrange"; arrange: HeaderArrange }
  | { type: "header/setSeparator"; separator: SeparatorMode }
  | { type: "header/setIconSet"; id: IconSetId }
  // Photo
  | { type: "photo/toggle" }
  | { type: "photo/setShape"; shape: PhotoShape }
  | { type: "photo/setSize"; mm: number; transient?: boolean }
  | { type: "photo/setPosition"; position: PhotoPosition }
  // Links
  | { type: "links/toggle" }
  | { type: "links/setStyle"; style: LinkStyle }
  | { type: "links/toggleUnderline" }
  // Footer
  | { type: "footer/toggle" }
  | { type: "footer/setText"; text: string }
  | { type: "footer/togglePageNumbers" }
  // Whole-document
  | { type: "design/reset" }
  | { type: "history/undo" }
  | { type: "history/redo" };

/**
 * `transient` only exists on the handful of drag-driven actions, so it is read
 * through an `in` narrowing rather than being bolted onto every variant.
 */
function isTransient(a: DesignAction): boolean {
  return "transient" in a && a.transient === true;
}

// ---------------------------------------------------------------------------
// Deep merge — used by template/apply
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Folds a template's `DeepPartial<ResumeDesign>` diff over `DEFAULT_DESIGN`.
 * Arrays and primitives replace wholesale; nested plain objects merge.
 * `undefined` values in the patch are ignored, so a template can omit a key
 * without clobbering the base.
 */
export function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch || !isPlainObject(base) || !isPlainObject(patch)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    const pv = (patch as Record<string, unknown>)[key];
    if (pv === undefined) continue;
    const bv = out[key];
    out[key] = isPlainObject(bv) && isPlainObject(pv) ? deepMerge(bv, pv) : pv;
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Template lookup
// ---------------------------------------------------------------------------

interface TemplateShape {
  design: DeepPartial<ResumeDesign>;
  sections: SectionSeed[];
  chrome: ChromeId;
}

/**
 * Looks up a template's design diff + section seeds + chrome from the
 * registry (`templates/index.ts`), which owns the 6 template definitions.
 *
 * IMPORTANT: after apply, NOTHING may read the template id again except
 * gallery highlighting. A template seeds the design once and never overrides
 * a user choice afterwards — that is the explicit fix for the old screen's
 * bug where `template === "classic"` hard-overrode fontFamily and
 * permanently killed the Font control. `chrome` is the one exception worth
 * calling out: it's folded into `design.chrome` at apply time below (a real,
 * persisted `ResumeDesign` field now — see that field's own doc comment),
 * not re-looked-up from the template id afterwards, so it behaves exactly
 * like every other design value the template seeds — set once, then freely
 * whatever the current snapshot says.
 */
function lookupTemplate(id: ResumeTemplateId): TemplateShape {
  const tpl = TEMPLATE_REGISTRY[id];
  return { design: tpl.design, sections: tpl.sections, chrome: tpl.chrome };
}

// ---------------------------------------------------------------------------
// Snapshot reducer helpers
// ---------------------------------------------------------------------------

/**
 * Patches one slice of `design`, returning the IDENTICAL snapshot when every
 * key in `next` already holds that value. This is where the reducer's identity
 * guarantee actually lives.
 */
function patch<K extends keyof ResumeDesign>(
  s: DesignSnapshot,
  slice: K,
  next: Partial<ResumeDesign[K]>,
): DesignSnapshot {
  const current = s.design[slice] as Record<string, unknown>;
  const patchObj = next as Record<string, unknown>;
  let changed = false;
  for (const key of Object.keys(patchObj)) {
    if (!Object.is(current[key], patchObj[key])) {
      changed = true;
      break;
    }
  }
  if (!changed) return s;
  return {
    design: { ...s.design, [slice]: { ...current, ...patchObj } },
    sections: s.sections,
  };
}

function withSections(s: DesignSnapshot, sections: SectionConfig[]): DesignSnapshot {
  return { design: s.design, sections };
}

const OFFSET_FIELD: Record<FontSizeOffsetKey, keyof ResumeDesign["fontSize"]> = {
  name: "nameOffPt",
  title: "titleOffPt",
  heading: "headingOffPt",
  entryHeader: "entryHeaderOffPt",
};

// ---------------------------------------------------------------------------
// Snapshot reducer
// ---------------------------------------------------------------------------

export function snapshotReducer(s: DesignSnapshot, a: DesignAction): DesignSnapshot {
  switch (a.type) {
    // --- Document ---------------------------------------------------------
    case "doc/setLanguage":
      return patch(s, "doc", { language: a.value });
    case "doc/setDateFormat":
      return patch(s, "doc", { dateFormat: a.id });
    case "doc/setPageFormat":
      return patch(s, "doc", { pageFormat: a.format });

    // --- Templates --------------------------------------------------------
    case "template/apply": {
      const tpl = lookupTemplate(a.id);
      const design = { ...deepMerge(DEFAULT_DESIGN, tpl.design), chrome: tpl.chrome };
      const sections = tpl.sections.length ? sectionsFromSeeds(tpl.sections) : DEFAULT_SECTIONS;
      return { design, sections };
    }

    // --- Layout -----------------------------------------------------------
    case "layout/setColumns":
      return patch(s, "layout", { columns: a.columns });
    case "layout/setSideWidth":
      return patch(s, "layout", { sideWidthPct: a.pct });

    // --- Sections ---------------------------------------------------------
    case "sections/reorder": {
      const { from, to } = a;
      const n = s.sections.length;
      if (from === to || from < 0 || from >= n || to < 0 || to >= n) return s;
      // Personal Details is locked to index 0 and rendered outside the sortable
      // context; neither dragging it nor dropping past it is legal.
      if (s.sections[from].locked) return s;
      if (to === 0 && s.sections[0].locked) return s;
      const next = s.sections.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return withSections(s, next);
    }
    case "sections/setColumn": {
      const i = s.sections.findIndex((x) => x.id === a.id);
      if (i === -1 || s.sections[i].column === a.column) return s;
      const next = s.sections.slice();
      next[i] = { ...next[i], column: a.column };
      return withSections(s, next);
    }
    case "sections/toggle": {
      const i = s.sections.findIndex((x) => x.id === a.id);
      if (i === -1 || s.sections[i].locked) return s;
      const next = s.sections.slice();
      next[i] = { ...next[i], visible: !next[i].visible };
      return withSections(s, next);
    }
    case "sections/rename": {
      const i = s.sections.findIndex((x) => x.id === a.id);
      if (i === -1 || s.sections[i].label === a.label) return s;
      const next = s.sections.slice();
      next[i] = { ...next[i], label: a.label };
      return withSections(s, next);
    }
    case "sections/addPageBreak": {
      // Idempotent on a repeated id, so a double-click can't desync dnd-kit
      // keys. The id comes from the caller because the reducer must stay pure.
      if (s.sections.some((x) => x.id === a.id)) return s;
      const entry: SectionConfig = {
        id: a.id,
        kind: "page-break",
        label: DEFAULT_SECTION_LABELS["page-break"],
        visible: true,
        column: "main",
      };
      const next = s.sections.slice();
      const at = a.index === undefined ? next.length : Math.min(Math.max(a.index, 1), next.length);
      next.splice(at, 0, entry);
      return withSections(s, next);
    }
    case "sections/remove": {
      const i = s.sections.findIndex((x) => x.id === a.id);
      if (i === -1 || s.sections[i].locked) return s;
      const next = s.sections.slice();
      next.splice(i, 1);
      return withSections(s, next);
    }

    // --- Font size --------------------------------------------------------
    case "fontSize/setBase":
      return patch(s, "fontSize", { basePt: a.pt });
    case "fontSize/setOffset":
      return patch(s, "fontSize", { [OFFSET_FIELD[a.key]]: a.pt });

    // --- Spacing ----------------------------------------------------------
    case "spacing/set":
      return patch(s, "spacing", { [a.key]: a.value });

    // --- Entries ----------------------------------------------------------
    case "entries/setStructure":
      return patch(s, "entries", { structure: a.structure });
    case "entries/setDatePosition":
      return patch(s, "entries", { datePosition: a.position });
    case "entries/setSubtitle":
      return patch(s, "entries", { subtitle: a.place });
    case "entries/toggleDates":
      return patch(s, "entries", { showDates: !s.design.entries.showDates });
    case "entries/toggleLocation":
      return patch(s, "entries", { showLocation: !s.design.entries.showLocation });
    case "entries/setBulletGlyph":
      return patch(s, "entries", { bulletGlyph: a.glyph });
    case "entries/toggleIndentBullets":
      return patch(s, "entries", { indentBullets: !s.design.entries.indentBullets });

    // --- Headings ---------------------------------------------------------
    case "headings/setStyle":
      return patch(s, "headings", { style: a.id });
    case "headings/setCaps":
      return patch(s, "headings", { caps: a.caps });
    case "headings/setIcons":
      return patch(s, "headings", { icons: a.icons });

    // --- Font -------------------------------------------------------------
    case "font/set":
      return patch(s, "font", { [a.slot]: a.id });

    // --- Colors -----------------------------------------------------------
    case "colors/setArea":
      return patch(s, "colors", { area: a.area });
    case "colors/setMode":
      return patch(s, "colors", { mode: a.mode });
    case "colors/setAccent":
      return patch(s, "colors", { accent: a.hex });
    case "colors/setAccentSlot":
      return patch(s, "colors", a.slot === 2 ? { accent2: a.hex } : { accent3: a.hex });
    case "colors/setNeutral":
      return patch(s, "colors", { [a.key]: a.hex });
    case "colors/toggleTarget": {
      const apply = { ...s.design.colors.apply, [a.target]: !s.design.colors.apply[a.target] };
      return {
        design: { ...s.design, colors: { ...s.design.colors, apply } },
        sections: s.sections,
      };
    }

    // --- Header -----------------------------------------------------------
    case "header/setAlign":
      return patch(s, "header", { align: a.align });
    case "header/setArrange":
      return patch(s, "header", { arrange: a.arrange });
    case "header/setSeparator":
      return patch(s, "header", { separator: a.separator });
    case "header/setIconSet":
      return patch(s, "header", { iconSet: a.id });

    // --- Photo ------------------------------------------------------------
    case "photo/toggle":
      return patch(s, "photo", { show: !s.design.photo.show });
    case "photo/setShape":
      return patch(s, "photo", { shape: a.shape });
    case "photo/setSize":
      return patch(s, "photo", { sizeMm: a.mm });
    case "photo/setPosition":
      return patch(s, "photo", { position: a.position });

    // --- Links ------------------------------------------------------------
    case "links/toggle":
      return patch(s, "links", { show: !s.design.links.show });
    case "links/setStyle":
      return patch(s, "links", { style: a.style });
    case "links/toggleUnderline":
      return patch(s, "links", { underline: !s.design.links.underline });

    // --- Footer -----------------------------------------------------------
    case "footer/toggle":
      return patch(s, "footer", { show: !s.design.footer.show });
    case "footer/setText":
      return patch(s, "footer", { text: a.text });
    case "footer/togglePageNumbers":
      return patch(s, "footer", { showPageNumbers: !s.design.footer.showPageNumbers });

    // --- Whole-document ---------------------------------------------------
    case "design/reset":
      if (s.design === DEFAULT_DESIGN && s.sections === DEFAULT_SECTIONS) return s;
      return { design: DEFAULT_DESIGN, sections: DEFAULT_SECTIONS };

    // History actions are handled a level up; they never touch the snapshot.
    case "history/undo":
    case "history/redo":
      return s;

    default:
      return s;
  }
}

// ---------------------------------------------------------------------------
// History reducer
// ---------------------------------------------------------------------------

/** Folds an open transient run (a slider drag) into `past`. */
function commitPending(s: HistoryState): HistoryState {
  if (s.pending === null) return s;
  if (s.pending === s.present) return { ...s, pending: null };
  return {
    past: [...s.past, s.pending].slice(-HISTORY_LIMIT),
    present: s.present,
    future: [],
    pending: null,
  };
}

export function historyReducer(s: HistoryState, a: DesignAction): HistoryState {
  if (a.type === "history/undo") {
    const base = commitPending(s);
    if (base.past.length === 0) return s;
    const previous = base.past[base.past.length - 1];
    return {
      past: base.past.slice(0, -1),
      present: previous,
      future: [base.present, ...base.future].slice(0, HISTORY_LIMIT),
      pending: null,
    };
  }

  if (a.type === "history/redo") {
    const base = commitPending(s);
    if (base.future.length === 0) return s;
    const [next, ...rest] = base.future;
    return {
      past: [...base.past, base.present].slice(-HISTORY_LIMIT),
      present: next,
      future: rest,
      pending: null,
    };
  }

  const present = snapshotReducer(s.present, a);
  const transient = isTransient(a);

  if (present === s.present) {
    // Nothing changed. A COMMIT still has to close out an open drag — the
    // final commit usually carries the same value the last transient action
    // already applied, so this branch is the common case at the end of a drag.
    if (!transient && s.pending !== null) return commitPending(s);
    return s;
  }

  if (transient) {
    return { ...s, present, pending: s.pending ?? s.present };
  }

  return {
    past: [...s.past, s.pending ?? s.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
    pending: null,
  };
}

// ---------------------------------------------------------------------------
// Init + selectors
// ---------------------------------------------------------------------------

/**
 * Builds the initial history. Pass nothing for the base "basic corporate"
 * look, a `ResumeTemplateId` to seed from a template, or a fully-formed
 * `ResumeDesign` to restore one.
 */
export function initHistory(source?: ResumeTemplateId | ResumeDesign): HistoryState {
  let present: DesignSnapshot;
  if (source === undefined) {
    present = { design: DEFAULT_DESIGN, sections: DEFAULT_SECTIONS };
  } else if (typeof source === "string") {
    const tpl = lookupTemplate(source);
    present = {
      design: { ...deepMerge(DEFAULT_DESIGN, tpl.design), chrome: tpl.chrome },
      sections: tpl.sections.length ? sectionsFromSeeds(tpl.sections) : DEFAULT_SECTIONS,
    };
  } else {
    present = { design: source, sections: DEFAULT_SECTIONS };
  }
  return { past: [], present, future: [], pending: null };
}

export function canUndo(s: HistoryState): boolean {
  return s.past.length > 0 || (s.pending !== null && s.pending !== s.present);
}

export function canRedo(s: HistoryState): boolean {
  return s.future.length > 0;
}
