import { OFFER_COPY_DEFAULTS, OFFER_COPY_MAX, OFFER_DETAIL_MAX, type Block } from "@/app/lib/mail/types";
import type { CanvasField } from "./MailFrame";

// Text typed in the canvas (the editor render's fields) and the blocks it belongs to. Pure, so the
// editor and anything else can share it. The limits are the inspector's (the backend refuses longer).

type OfferBlock = Extract<Block, { type: "offer" }>;
type OfferKey = keyof typeof OFFER_COPY_DEFAULTS;

const TEXT_MAX = { heading: 200, paragraph: 5000, button: 80 } as const;
const isOfferKey = (field: CanvasField): field is OfferKey => field === "kicker" || field === "headline" || field === "button";

/**
 * The block with a field set to what was typed in the canvas, or null when the block has no such
 * field. An offer line typed back to its exact default (or emptied) is stored as empty: the box
 * shows the default then, and a later change of the default reaches it.
 */
export function withCanvasText(block: Block, field: CanvasField, text: string): Block | null {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return field === "text" ? { ...block, text: text.slice(0, TEXT_MAX[block.type]) } : null;
    case "button":
      return field === "label" ? { ...block, label: text.slice(0, TEXT_MAX.button) } : null;
    case "offer": {
      if (field === "detail") {
        // The code line: empty (or emptied) is the default, which the box draws (none beside a countdown).
        const value = text.slice(0, OFFER_DETAIL_MAX);
        const next: OfferBlock = { ...block };
        if (!value.trim()) delete next.detail;
        else next.detail = value;
        return next;
      }
      if (!isOfferKey(field)) return null;
      const value = text.slice(0, OFFER_COPY_MAX[field]);
      const next: OfferBlock = { ...block };
      if (!value.trim() || value === OFFER_COPY_DEFAULTS[field]) delete next[field];
      else next[field] = value;
      return next;
    }
    default:
      return null;
  }
}

/** What a field shows in the canvas: its text, and an offer line's default when the block leaves it empty. */
const shownText = (block: Block, field: CanvasField): string | null => {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return field === "text" ? block.text ?? "" : null;
    case "button":
      return field === "label" ? block.label ?? "" : null;
    case "offer": {
      // The code line's default depends on the offer (its countdown, its style): the server's render draws it.
      if (field === "detail") return block.detail ?? "";
      if (!isOfferKey(field)) return null;
      const own = block[field] ?? "";
      return own.trim() ? own : OFFER_COPY_DEFAULTS[field];
    }
    default:
      return null;
  }
};

const FIELDS_OF: Partial<Record<Block["type"], CanvasField[]>> = {
  heading: ["text"],
  paragraph: ["text"],
  button: ["label"],
  offer: ["kicker", "headline", "button", "detail"],
};

/** The canvas fields an inspector edit changed, with what each should now show (drawn at once in the frame). */
export function canvasPatches(prev: Block | undefined, next: Block): Array<{ field: CanvasField; text: string }> {
  if (!prev || prev.type !== next.type) return [];
  return (FIELDS_OF[next.type] ?? []).flatMap((field) => {
    const before = shownText(prev, field);
    const after = shownText(next, field);
    return after !== null && after !== before ? [{ field, text: after }] : [];
  });
}
