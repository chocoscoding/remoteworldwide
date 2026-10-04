"use client";

// Picking, on the page itself, what an AI tool works on (owner, 2026-10-04): the tools no longer
// guess. Run puts the screen in pick mode; over whatever may be picked the cursor turns into the
// black pick cursor, a label beside it says what a click will do, the target under it is framed on
// the paper, and a click runs the tool on it. Esc, or Cancel on the tool's row, leaves pick mode
// with nothing run.
//
// What may be picked, from the narrowest: one bullet, a role, a section (by anywhere in it that is
// not something narrower the tool takes), the whole resume (anywhere else on the page — its
// header, its margins). Each tool says which of these it takes, and the narrowest one it takes
// under the pointer is the target: Quantify over a bullet picks the bullet, Rewrite (which takes
// roles, not bullets) picks the role around it.
//
// Listens on the document rather than on the preview, so it needs nothing from the paper but the
// markers it carries: `data-resume-paper` on the page, `data-resume-section` on each section (and
// `data-resume-custom`, its id, on a section the person made up), `data-resume-entry` on each role
// and `data-resume-bullet` on each bullet or point. Hidden copies of the paper (the PDF export's)
// take no pointer events, so only the one on screen can be picked.
//
// Sections the person made up are never left out (owner, 2026-10-04): a tool that takes sections
// takes them ("custom"), and one that takes a single line takes one of their points too.

import { useEffect, useRef, useState, type FC } from "react";
import { createPortal } from "react-dom";

/** A section a tool can be pointed at, by its section kind ("training" is the certifications; "custom", any made-up one). */
export type PickSection = "summary" | "experience" | "education" | "skills" | "training" | "projects" | "custom";

/** Something on the page a tool can work on. */
export type PageTarget =
  | { kind: "resume" }
  /** `customId` names which made-up section, when `section` is "custom". */
  | { kind: "section"; section: PickSection; customId?: string }
  | { kind: "role"; entryId: string }
  | { kind: "bullet"; entryId: string; index: number }
  /** One point of a made-up section, by its stored index. */
  | { kind: "point"; customId: string; index: number };

/** What a tool takes. */
export interface PickKinds {
  resume?: boolean;
  sections?: readonly PickSection[];
  role?: boolean;
  /** One line: a role's bullet, or a made-up section's point. */
  bullet?: boolean;
}

const SELECTOR = {
  bullet: '[data-resume-section="experience"] [data-resume-bullet]',
  point: '[data-resume-section="custom"] [data-resume-bullet]',
  role: '[data-resume-section="experience"] [data-resume-entry]',
  section: "[data-resume-section]",
  resume: "[data-resume-paper]",
};

/** A line's stored index: what follows the last ":" of its `data-resume-bullet`. */
const lineIndex = (marker: string | null | undefined): number | null => {
  const index = (marker ?? "").split(":").pop() ?? "";
  return /^\d+$/.test(index) ? Number(index) : null;
};

/** A black arrow with a lime dot, the house's colours: the pick cursor. */
const PICK_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><path d='M3 2l15.5 7.2-6.7 2.3-2.4 6.8z' fill='#222325' stroke='#fff' stroke-width='1.6' stroke-linejoin='round'/><circle cx='19.5' cy='19.5' r='4' fill='#e1f073' stroke='#222325' stroke-width='1.6'/></svg>",
)}") 3 2, pointer`;

const targetOf = (element: Element | null, kinds: PickKinds): PageTarget | null => {
  if (!element) return null;
  if (kinds.bullet) {
    const [entryId, index] = (element.closest(SELECTOR.bullet)?.getAttribute("data-resume-bullet") ?? "").split(":");
    if (entryId && index !== undefined && /^\d+$/.test(index)) return { kind: "bullet", entryId, index: Number(index) };
    const point = element.closest(SELECTOR.point);
    const customId = point?.closest(SELECTOR.section)?.getAttribute("data-resume-custom");
    const pointIndex = lineIndex(point?.getAttribute("data-resume-bullet"));
    if (customId && pointIndex !== null) return { kind: "point", customId, index: pointIndex };
  }
  if (kinds.role) {
    const entryId = element.closest(SELECTOR.role)?.getAttribute("data-resume-entry");
    if (entryId) return { kind: "role", entryId };
  }
  if (kinds.sections?.length) {
    const sectionElement = element.closest(SELECTOR.section);
    const section = sectionElement?.getAttribute("data-resume-section") as PickSection | null | undefined;
    if (section && kinds.sections.includes(section)) {
      if (section !== "custom") return { kind: "section", section };
      const customId = sectionElement?.getAttribute("data-resume-custom");
      if (customId) return { kind: "section", section, customId };
    }
  }
  if (kinds.resume && element.closest(SELECTOR.resume)) return { kind: "resume" };
  return null;
};

const keyOf = (target: PageTarget | null): string =>
  !target
    ? ""
    : target.kind === "resume"
      ? "resume"
      : target.kind === "section"
        ? `section:${target.section}:${target.customId ?? ""}`
        : target.kind === "role"
          ? `role:${target.entryId}`
          : target.kind === "point"
            ? `point:${target.customId}:${target.index}`
            : `bullet:${target.entryId}:${target.index}`;

/** The cursor goes over everything the tool takes, and anything inside it. */
const pickableSelector = (kinds: PickKinds): string =>
  [
    kinds.resume ? SELECTOR.resume : null,
    ...(kinds.sections ?? []).map((section) => `[data-resume-section="${section}"]`),
    kinds.role ? SELECTOR.role : null,
    kinds.bullet ? SELECTOR.bullet : null,
    kinds.bullet ? SELECTOR.point : null,
  ]
    .filter((selector): selector is string => selector !== null)
    .flatMap((selector) => [selector, `${selector} *`])
    .join(", ");

export interface PagePickerProps {
  /** What may be picked. */
  kinds: PickKinds;
  /** The label beside the cursor: what a click will do on this target, or what to pick when on nothing. */
  label: (target: PageTarget | null) => string;
  /** The target under the pointer changed (null: none), so the paper can frame it. */
  onHover: (target: PageTarget | null) => void;
  onPick: (target: PageTarget) => void;
  onCancel: () => void;
}

const PagePicker: FC<PagePickerProps> = ({ kinds, label, onHover, onPick, onCancel }) => {
  const [pointer, setPointer] = useState<{ x: number; y: number; target: PageTarget | null } | null>(null);
  // The latest callbacks, so the document listeners are added once per pick, not once per render.
  const latest = useRef({ kinds, onHover, onPick, onCancel });
  useEffect(() => {
    latest.current = { kinds, onHover, onPick, onCancel };
  });

  useEffect(() => {
    let hovered = "";

    const onMove = (event: PointerEvent) => {
      const target = targetOf(event.target instanceof Element ? event.target : null, latest.current.kinds);
      if (keyOf(target) !== hovered) {
        hovered = keyOf(target);
        latest.current.onHover(target);
      }
      setPointer({ x: event.clientX, y: event.clientY, target });
    };
    // Capture, so the pick lands before anything the paper would do with the click.
    const onClick = (event: MouseEvent) => {
      const target = targetOf(event.target instanceof Element ? event.target : null, latest.current.kinds);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.onPick(target);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      latest.current.onCancel();
    };
    const onLeave = () => setPointer(null);

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (hovered) latest.current.onHover(null);
    };
  }, []);

  return createPortal(
    <>
      <style>{`${pickableSelector(kinds)} { cursor: ${PICK_CURSOR} !important; }`}</style>
      {pointer && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed z-[60] flex items-center gap-2 rounded-full bg-[#222325] py-1.5 pl-3 pr-2 text-xs font-bold text-white shadow-[2px_2px_0_0_#e1f073]"
          style={{ left: pointer.x + 18, top: pointer.y + 20 }}>
          {label(pointer.target)}
          <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">Esc</span>
        </div>
      )}
    </>,
    document.body,
  );
};

export default PagePicker;
