import type { FC } from "react";
import { ACCENT_COLORS, OFFER_COPY_DEFAULTS, type Block, type MailDesign } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { MailButton } from "./OfferBox";
import { sampleText } from "./blocks";

/**
 * A small static picture of a mail, drawn from its blocks in HTML (no iframe, no render call): the
 * heading line, text lines, the button or offer chip, in the mail's look and accent. The first few
 * blocks only; the rest fades out.
 */
const MailThumb: FC<{ blocks: Block[]; design: MailDesign; className?: string }> = ({ blocks, design, className }) => {
  const c = ACCENT_COLORS[design.accent] ?? ACCENT_COLORS.lime;
  const shown = blocks.slice(0, 7);
  return (
    <div aria-hidden className={cn("relative h-40 overflow-hidden bg-[#f9f8f1] px-4 pt-3", className)}>
      <div className={cn("mx-auto max-w-[260px] overflow-hidden rounded-t-lg border border-b-0 border-black/10 bg-white", design.look === "letter" ? "rounded-t-sm" : "")}>
        {design.look === "bold" ? (
          <div className="px-3 py-2" style={{ background: c.fill, color: c.text }}>
            <span className="text-[8px] font-extrabold tracking-wide">RemoteWorldwide</span>
          </div>
        ) : design.look === "brand" ? (
          <div className="flex justify-center pt-2">
            <span className="flex items-center gap-1 text-[7px] font-extrabold text-[#222325]">
              <span className="inline-block h-2 w-2 rounded-sm bg-[#222325]" /> RemoteWorldwide
            </span>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          {shown.length ? shown.map((b, i) => <ThumbBlock key={i} block={b} design={design} />) : <p className="py-6 text-center text-[9px] text-gray-400">No blocks yet</p>}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#f9f8f1] to-transparent" />
    </div>
  );
};

const ThumbBlock: FC<{ block: Block; design: MailDesign }> = ({ block, design }) => {
  const c = ACCENT_COLORS[design.accent] ?? ACCENT_COLORS.lime;
  switch (block.type) {
    case "heading":
      return <p className={cn("truncate font-extrabold text-[#222325]", design.look === "letter" ? "text-[9px]" : "text-[10px]")}>{sampleText(block.text) || "Heading"}</p>;
    case "paragraph": {
      const text = sampleText(block.text);
      return text ? (
        <p className="line-clamp-2 text-[8px] leading-[1.35] text-gray-500">{text}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="h-1 w-full rounded bg-gray-200" />
          <span className="h-1 w-2/3 rounded bg-gray-200" />
        </div>
      );
    }
    case "button":
      return <MailButton design={design} label={sampleText(block.label) || "Button"} size="xs" />;
    case "image":
      return <div className="h-7 w-full rounded bg-gray-100" />;
    case "divider":
      return <div className="my-0.5 border-t border-gray-200" />;
    case "spacer":
      return <div className="h-1.5" aria-hidden />;
    case "signature":
      return <p className="text-[9px] font-extrabold text-[#222325]">Theo</p>;
    case "feedback":
      return (
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-3 flex-1 rounded border border-gray-200" />
          ))}
        </div>
      );
    case "offer":
      return (
        <div
          className={cn("rounded px-2 py-1", design.look === "letter" ? "border border-black/20" : "")}
          style={design.look === "letter" ? undefined : { background: c.fill, color: c.text }}>
          <p className="truncate text-[6px] font-extrabold uppercase tracking-wider opacity-75">{sampleText(block.kicker?.trim() || OFFER_COPY_DEFAULTS.kicker)}</p>
          <p className="truncate text-[10px] font-extrabold">{sampleText(block.headline?.trim() || OFFER_COPY_DEFAULTS.headline)}</p>
        </div>
      );
    default:
      return null;
  }
};

export default MailThumb;
