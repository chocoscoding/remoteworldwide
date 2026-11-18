import type { CSSProperties, FC } from "react";
import { ACCENT_COLORS, DEFAULT_DESIGN, type MailDesign, type OfferLook } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";

const INK = "#222325";

/**
 * The offer box drawn in HTML, close to how the mail renderer draws it: the small line, the
 * headline, an optional countdown, a code line and the button. The offer's own look picks the box:
 * "auto" follows the mail (the accent fill, or a thin border in the letter look), "filled", "outline"
 * (a 2px accent edge) or "coupon" (a dashed edge, the code in a monospace chip); its accent, when
 * set, colours the box and its button only. Used where a real render is too heavy (library cards,
 * the design sample) or failed.
 */
const OfferBox: FC<{
  design?: MailDesign;
  /** The offer's look; missing = follow the mail. */
  look?: OfferLook | null;
  kicker: string;
  headline: string;
  /** The sample code: "Code THEO20, ..." on the detail line, or the chip in a coupon. */
  code?: string;
  detail?: string;
  button?: string | null;
  size?: "sm" | "md";
  className?: string;
}> = ({ design = DEFAULT_DESIGN, look, kicker, headline, code, detail, button, size = "md", className }) => {
  const accent = look?.accent ?? design.accent;
  const c = ACCENT_COLORS[accent] ?? ACCENT_COLORS.lime;
  const letter = design.look === "letter";
  const style = look?.style ?? "auto";
  // What the box is: today's per-look box for "auto", else the style asked for.
  const box = style === "auto" ? (letter ? "thin" : "filled") : style;
  const sm = size === "sm";
  const coupon = box === "coupon";

  const boxStyle: CSSProperties =
    box === "filled"
      ? ({ "--br-c": c.edge, borderColor: c.edge, background: c.fill, color: c.text } as CSSProperties)
      : box === "thin"
        ? { borderColor: "rgba(34,35,37,0.2)", background: "#fff", color: INK }
        : { borderColor: c.edge, borderWidth: 2, borderStyle: coupon ? "dashed" : "solid", background: "#fff", color: INK };

  return (
    <div className={cn("flex flex-col", sm ? "gap-2" : "gap-3", className)}>
      <div
        className={cn(
          "rounded-xl",
          sm ? "px-3 py-2.5" : "px-5 py-4",
          // The hard edge only on a filled box outside the letter look, as the renderer draws it.
          box === "filled" && !letter ? "br-shadow" : box === "filled" || box === "thin" ? "border" : "",
        )}
        style={boxStyle}>
        <p className={cn("font-extrabold uppercase opacity-75", sm ? "text-[8px] tracking-[0.12em]" : "text-[11px] tracking-[0.12em]")}>{kicker}</p>
        <p className={cn("font-extrabold leading-tight tracking-tight", sm ? "mt-0.5 text-base" : letter ? "mt-1 text-xl" : "mt-1 text-[26px]")}>{headline}</p>
        {look?.countdown ? <CountdownStrip size={size} /> : null}
        {code || detail ? (
          <p className={cn("font-semibold", sm ? "mt-1 text-[9px]" : "mt-2 text-[13px]")}>
            {code ? (
              coupon ? (
                <span className={cn("mr-1.5 inline-block rounded bg-gray-100 font-mono font-bold tracking-wider text-black", sm ? "px-1 py-px" : "px-2 py-0.5")}>{code}</span>
              ) : (
                `Code ${code}${detail ? ", " : ""}`
              )
            ) : null}
            {detail}
          </p>
        ) : null}
      </div>
      {button ? <MailButton design={{ ...design, accent }} label={button} size={size} /> : null}
    </div>
  );
};

/** The countdown image's stand-in: a static "02 : 11 : 59", in the image's tiles (ink edge, lime on the first). */
const CountdownStrip: FC<{ size: "sm" | "md" }> = ({ size }) => {
  const sm = size === "sm";
  const tile = cn("inline-block rounded border font-mono font-bold tabular-nums", sm ? "px-1 text-[9px]" : "px-2 py-0.5 text-base");
  return (
    <p role="img" aria-label="Countdown, ticking in the mail" className={cn("flex items-center font-bold", sm ? "mt-1 gap-0.5 text-[9px]" : "mt-2 gap-1.5 text-base")}>
      <span className={tile} style={{ borderColor: INK, background: "#e1f073", color: INK }}>
        02
      </span>
      <span aria-hidden>:</span>
      <span className={tile} style={{ borderColor: INK, background: "#fff", color: INK }}>
        11
      </span>
      <span aria-hidden>:</span>
      <span className={tile} style={{ borderColor: INK, background: "#fff", color: INK }}>
        59
      </span>
    </p>
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
