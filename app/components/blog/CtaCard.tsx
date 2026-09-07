import type { FC } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CtaSummary {
  key: string;
  eyebrow: string | null;
  headline: string;
  body: string;
  buttonLabel: string;
  tone: "INK" | "LIME" | "PAPER";
  imageUrl?: string | null;
  imageSide?: "LEFT" | "RIGHT";
}

export interface CtaCardProps {
  cta: CtaSummary;
  variant: "inline" | "end" | "band" | "side";
  placement: "inline" | "end" | "index-band" | "category-band";
  blogSlug?: string;
  className?: string;
}

export function ctaHref(key: string, placement: string, blogSlug?: string): string {
  const params = new URLSearchParams({ s: placement });
  if (blogSlug) params.set("p", blogSlug);
  return `/go/${encodeURIComponent(key)}?${params.toString()}`;
}

const TONE: Record<
  CtaSummary["tone"],
  {
    card: string;
    eyebrow: string;
    text: string;
    sub: string;
    button: string;
    frame: string;
  }
> = {
  INK: {
    card: "bg-primary shadow-[5px_5px_0_0_#e1f073]",
    eyebrow: "text-secondary",
    text: "text-white",
    sub: "text-white/70",
    button: "bg-secondary text-primary shadow-[4px_4px_0_0_#ffffff] hover:shadow-[2px_2px_0_0_#ffffff]",
    frame: "border-secondary",
  },
  LIME: {
    card: "bg-secondary shadow-[5px_5px_0_0_#222325]",
    eyebrow: "text-primary/70",
    text: "text-primary",
    sub: "text-primary/75",
    button: "bg-primary text-white shadow-[4px_4px_0_0_#ffffff] hover:shadow-[2px_2px_0_0_#ffffff]",
    frame: "border-primary",
  },
  PAPER: {
    card: "bg-primary2 shadow-[5px_5px_0_0_#222325]",
    eyebrow: "text-primary/60",
    text: "text-primary",
    sub: "text-primary/70",
    button: "bg-primary text-white shadow-[4px_4px_0_0_#e1f073] hover:shadow-[2px_2px_0_0_#e1f073]",
    frame: "border-primary",
  },
};

const CtaCard: FC<CtaCardProps> = ({ cta, variant, placement, blogSlug, className }) => {
  const t = TONE[cta.tone] ?? TONE.INK;
  const band = variant === "band";
  const hasImage = Boolean(cta.imageUrl);
  const imageLeft = hasImage && cta.imageSide === "LEFT";

  const copy = (
    <div className="min-w-0">
      {cta.eyebrow && <p className={cn("text-[11px] font-extrabold uppercase tracking-[0.14em]", t.eyebrow)}>{cta.eyebrow}</p>}
      <h3
        className={cn(
          "mt-1.5 font-extrabold leading-tight",
          t.text,
          variant === "inline" && "text-xl md:text-2xl",
          variant === "side" && "text-lg md:text-xl",
          (variant === "end" || variant === "band") && "text-2xl md:text-3xl",
        )}>
        {cta.headline}
      </h3>
      <p className={cn("mt-2 max-w-[60ch]", t.sub, variant === "inline" || variant === "side" ? "text-sm md:text-base" : "text-base")}>{cta.body}</p>
      <a
        href={ctaHref(cta.key, placement, blogSlug)}
        className={cn(
          "mt-5 inline-flex flex-none items-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition-[transform,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
          variant === "side" && "mt-4 px-4 py-2.5",
          t.button,
        )}>
        {cta.buttonLabel}
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );

  return (
    <section
      aria-label={cta.headline}
      data-image-side={hasImage ? (cta.imageSide ?? "RIGHT") : undefined}
      className={cn(
        "not-prose rounded-[20px] border-2 border-primary",
        t.card,
        variant === "inline" && "my-8 p-5 md:p-6",
        variant === "end" && "mt-10 p-6 md:p-8",
        band && "p-7 md:p-10",
        variant === "side" && "rounded-2xl p-5 shadow-[3px_3px_0_0_#222325]",
        className,
      )}>
      {hasImage ? (
        <div
          className={cn(
            "grid gap-5 md:items-center md:gap-7",
            variant === "side"
              ? "grid-cols-1"
              : cn(
                  band ? "md:grid-cols-[minmax(0,1fr)_30%]" : "md:grid-cols-[minmax(0,1fr)_40%]",
                  imageLeft && (band ? "md:grid-cols-[30%_minmax(0,1fr)]" : "md:grid-cols-[40%_minmax(0,1fr)]"),
                ),
          )}>
          <figure
            className={cn(
              "relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-white",
              t.frame,
              "order-first",
              imageLeft ? "md:order-first" : "md:order-last",
            )}>
            <Image src={cta.imageUrl!} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
          </figure>
          {copy}
        </div>
      ) : band ? (
        <div className="md:flex md:items-center md:justify-between md:gap-10">
          <div className="min-w-0">
            {cta.eyebrow && <p className={cn("text-[11px] font-extrabold uppercase tracking-[0.14em]", t.eyebrow)}>{cta.eyebrow}</p>}
            <h3 className={cn("mt-1.5 font-extrabold leading-tight text-2xl md:text-3xl", t.text)}>{cta.headline}</h3>
            <p className={cn("mt-2 max-w-[60ch] text-base", t.sub)}>{cta.body}</p>
          </div>
          <a
            href={ctaHref(cta.key, placement, blogSlug)}
            className={cn(
              "mt-5 inline-flex flex-none items-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition-[transform,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none md:mt-0",
              t.button,
            )}>
            {cta.buttonLabel}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      ) : (
        copy
      )}
    </section>
  );
};

export default CtaCard;
