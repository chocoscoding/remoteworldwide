// Stored design -> the `ResumeDesign` / `SectionConfig[]` the editor runs on.
//
// A saved resume holds its look as a PATCH, and two writers produce one:
//
//   the editor   saves its whole design — a patch that happens to state every key
//   the builder  saves a template id plus a narrow whitelisted diff
//
// Both fold the same way: `DEFAULT_DESIGN`, then the template's own diff and
// chrome if there is one, then the stored patch on top. That is the identical
// path `template/apply` takes, so a generated document and a hand-made one
// cannot render differently for the same values. A design that was never
// touched is stored as nothing at all and comes back as the default look.
//
// The stored patch is believed LEAF BY LEAF, and only where its type matches
// the default at the same path. The server checks structure, not meaning — it
// does not know what `fontSize.basePt` is — so this is the one place that does.
// The rule is the cheapest one that closes the trap `design-types.ts` warns
// about: a number that arrives as the string "11" does not render slightly
// wrong, it concatenates into "110.5" and breaks the page. A leaf of the wrong
// type, or under a key no default has (a knob removed since it was saved), is
// dropped and the default stands.

import { DEFAULT_DESIGN, DEFAULT_SECTIONS, sectionsFromSeeds } from "./design-defaults";
import { deepMerge } from "./design-reducer";
import type { ColumnSlot, ResumeDesign, ResumeTemplateId, SectionConfig, SectionKind } from "./design-types";
import { TEMPLATE_REGISTRY } from "./templates";

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `base` with every leaf of `patch` that has the same type as the leaf it would replace. */
function mergeTrusted<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in base)) continue;
    const current = (base as Record<string, unknown>)[key];
    if (isPlainObject(current)) out[key] = mergeTrusted(current, value);
    else if (typeof value === typeof current && (typeof value !== "number" || Number.isFinite(value))) out[key] = value;
  }
  return out as T;
}

const templateOf = (id: string | null | undefined) => (id && id in TEMPLATE_REGISTRY ? TEMPLATE_REGISTRY[id as ResumeTemplateId] : null);

export function hydrateDesign(template: string | null | undefined, stored: unknown): ResumeDesign {
  const tpl = templateOf(template);
  const base = tpl ? { ...deepMerge(DEFAULT_DESIGN, tpl.design), chrome: tpl.chrome } : DEFAULT_DESIGN;
  // Nothing stored and no template is the shared default itself, by reference:
  // every untouched document then starts from one object, as it did before.
  return isPlainObject(stored) ? mergeTrusted(base, stored) : base;
}

const SECTION_KINDS: ReadonlySet<string> = new Set<SectionKind>([
  "personal",
  "summary",
  "experience",
  "education",
  "skills",
  "training",
  "projects",
  "custom",
  "page-break",
]);

/**
 * Stored rows -> `SectionConfig[]`. A row is a `SectionSeed` that may already
 * carry its id (the editor's saves do, the builder's seeds do not), so this is
 * `sectionsFromSeeds` with the saved ids kept — they are dnd-kit keys, and must
 * stay unique, so a repeated or missing one falls back to the derived id.
 *
 * `ResumePaper` splits `sections[0]` off positionally as the locked Personal
 * Details block. A list that does not open with it would render someone's
 * Summary as their header, so such a list is not used at all.
 */
export function hydrateSections(template: string | null | undefined, stored: unknown): SectionConfig[] {
  const tpl = templateOf(template);
  const fallback = tpl?.sections.length ? sectionsFromSeeds(tpl.sections) : DEFAULT_SECTIONS;
  if (!Array.isArray(stored) || stored.length === 0) return fallback;

  const rows = stored.filter((row): row is Record<string, unknown> => isPlainObject(row) && typeof row.kind === "string" && SECTION_KINDS.has(row.kind));
  if (rows[0]?.kind !== "personal") return fallback;

  const derived = sectionsFromSeeds(
    rows.map((row, index) => ({
      kind: row.kind as SectionKind,
      ...(typeof row.label === "string" && row.label ? { label: row.label } : {}),
      ...(typeof row.visible === "boolean" ? { visible: row.visible } : {}),
      ...(row.column === "main" || row.column === "side" ? { column: row.column as ColumnSlot } : {}),
      // The first row IS Personal Details, whatever the stored flag says.
      ...(index === 0 || row.locked === true ? { locked: true } : {}),
    })),
  );

  const used = new Set<string>();
  return derived.map((section, index) => {
    const saved = rows[index].id;
    let id = typeof saved === "string" && saved && !used.has(saved) ? saved : section.id;
    if (used.has(id)) id = `${section.id}-${index}`;
    used.add(id);
    return { ...section, id };
  });
}
