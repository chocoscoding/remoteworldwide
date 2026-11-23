import { CornerDownLeft, Heading, Image as ImageIcon, Minus, MousePointerClick, PenLine, Pilcrow, Smile, TicketPercent, type LucideIcon } from "lucide-react";
import { DEFAULT_DESIGN, type Block, type BlockType, type MailDesign, type TemplateContent } from "@/app/lib/mail/types";

// Small pure helpers the content editor, the block outline and the library cards share. No
// "use client": server pages import from here too.

/** The offers, inside Content. */
export const OFFERS_HREF = "/heroshima/outreach/templates?show=offers";

export const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  heading: Heading,
  paragraph: Pilcrow,
  button: MousePointerClick,
  image: ImageIcon,
  divider: Minus,
  spacer: CornerDownLeft,
  signature: PenLine,
  feedback: Smile,
  offer: TicketPercent,
};

/** A new block of a type, with a sensible start. */
export const freshBlock = (type: BlockType): Block => {
  switch (type) {
    case "heading":
      return { type, text: "" };
    case "paragraph":
      return { type, text: "" };
    case "button":
      return { type, label: "", url: "{{appUrl}}/dashboard" };
    case "image":
      return { type, src: "", alt: "" };
    case "offer":
      return { type };
    default:
      return { type } as Block;
  }
};

/** What the template variables read as in a thumbnail or a summary (never sent anywhere). */
const SAMPLE_VALUES: Record<string, string> = {
  firstName: "there",
  plan: "Pro",
  creditsLeft: "12",
  targetRole: "Product designer",
  appUrl: "remoteworldwide.com",
  offerDiscount: "20%",
  offerExpiresAt: "Friday",
  offerCode: "THEO20",
  offerUrl: "the offer link",
};

/** Text as a reader would roughly see it: variables filled with samples, markdown dropped. */
export const sampleText = (text: string | undefined | null): string =>
  String(text ?? "")
    .replace(/\{\{\s*([\w.]+)\s*(?:\|([^}]*))?\}\}/g, (_, name: string, fallback?: string) => SAMPLE_VALUES[name] ?? fallback ?? name)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The first words of a block, for the outline. */
export const blockSummary = (block: Block): string => {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return sampleText(block.text) || "Empty";
    case "button":
      return sampleText(block.label) || "No label";
    case "image":
      return block.alt?.trim() || (block.src ? "Image" : "No image yet");
    case "divider":
      return "Line";
    case "spacer":
      return "Empty line";
    case "signature":
      return "Theo's sign-off";
    case "feedback":
      return "How is it going?";
    case "offer":
      return sampleText(block.headline?.trim() || "{{offerDiscount}} off");
    default:
      return "";
  }
};

/** The look a mail is drawn with: its own design, else the brand default, else the house default. */
export const resolveDesign = (design: MailDesign | null | undefined, brand?: MailDesign | null): MailDesign => design ?? brand ?? DEFAULT_DESIGN;

/** A template's (or campaign's) content, copied field by field so nothing else rides along to the API. */
export const pickContent = (c: Partial<TemplateContent> | null | undefined): TemplateContent => ({
  subject: c?.subject ?? "",
  preview: c?.preview ?? "",
  blocks: Array.isArray(c?.blocks) ? c.blocks : [],
  sender: c?.sender === "founder" ? "founder" : "brand",
  pref: c?.pref === undefined ? "emailProductNews" : c.pref,
  feedbackFooter: Boolean(c?.feedbackFooter),
  design: c?.design ?? null,
});
