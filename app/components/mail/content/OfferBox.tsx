import type { CSSProperties, FC } from "react";
import { ACCENT_COLORS, DEFAULT_DESIGN, type MailDesign } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";

/**
 * The offer box drawn in HTML, close to how the mail renderer draws it: the accent fill (or a thin
 * border in the letter look), the small line, the headline, a code line and the button. Used where
 * a real render is too heavy (library cards, the design sample) or failed.
 */
const OfferBox: FC<{
  design?: MailDesign;
  kicker: string;
  headline: string;
  detail?: string;
  button?: string | null;
  size?: "sm" | "md";
  className?: string;
}> = ({ design = DEFAULT_DESIGN, kicker, headline, detail, button, size = "md", className }) => {
  const c = ACCENT_COLORS[design.accent] ?? ACCENT_COLORS.lime;
  const letter = design.look === "letter";
  const sm = size === "sm";
  const edge = { "--br-c": c.edge, borderColor: c.edge } as CSSProperties;

  return (
    <div className={cn("flex flex-col", sm ? "gap-2" : "gap-3", className)}>
      <div
        className={cn("rounded-xl", sm ? "px-3 py-2.5" : "px-5 py-4", letter ? "border" : "br-shadow")}
        style={letter ? { borderColor: "rgba(34,35,37,0.2)", background: "#fff", color: "#222325" } : { ...edge, background: c.fill, color: c.text }}>
        <p className={cn("font-extrabold uppercase opacity-75", sm ? "text-[8px] tracking-[0.12em]" : "text-[11px] tracking-[0.12em]")}>{kicker}</p>
        <p className={cn("font-extrabold leading-tight tracking-tight", sm ? "mt-0.5 text-base" : letter ? "mt-1 text-xl" : "mt-1 text-[26px]")}>{headline}</p>
        {detail ? <p className={cn("font-semibold", sm ? "mt-1 text-[9px]" : "mt-2 text-[13px]")}>{detail}</p> : null}
      </div>
      {button ? <MailButton design={design} label={button} size={size} /> : null}
    </div>
  );
};

/** A mail button in a design: the accent fill, square or round corners, the hard edge except in the letter look. */
export const MailButton: FC<{ design?: MailDesign; label: string; size?: "xs" | "sm" | "md"; className?: string }> = ({ design = DEFAULT_DESIGN, label, size = "md", className }) => {
  const c = ACCENT_COLORS[design.accent] ?? ACCENT_COLORS.lime;
  const letter = design.look === "letter";
  return (
    <span
      className={cn(
        "inline-block w-fit max-w-full truncate align-top font-bold",
        size === "xs" ? "px-2 py-0.5 text-[8px]" : size === "sm" ? "px-2.5 py-1 text-[9px]" : "px-4 py-2 text-sm",
        // The tiny thumbnail button keeps just its edge: a grid of cards stays calm.
        letter || size === "xs" ? "border" : "br-shadow",
        className,
      )}
      style={{ "--br-c": c.edge, borderColor: c.edge, background: c.fill, color: c.text, borderRadius: design.button === "round" ? 999 : 6 } as CSSProperties}>
      {label}
      {letter ? "" : " →"}
    </span>
  );
};

export default OfferBox;
