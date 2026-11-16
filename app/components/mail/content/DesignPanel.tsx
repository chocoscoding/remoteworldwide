"use client";

import type { CSSProperties, FC } from "react";
import Link from "next/link";
import {
  ACCENT_COLORS,
  ACCENT_LABELS,
  BUTTON_SHAPE_LABELS,
  LOOK_LABELS,
  MAIL_ACCENTS,
  MAIL_BUTTON_SHAPES,
  MAIL_LOOKS,
  type MailDesign,
  type MailLook,
} from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { Segmented, Switch } from "../ui";
import OfferBox, { MailButton } from "./OfferBox";
import { resolveDesign } from "./blocks";

const LOOK_NOTES: Record<MailLook, string> = {
  brand: "The product look, with the wordmark",
  letter: "A plain personal note",
  bold: "An accent band up top",
};

/**
 * How one mail looks: the brand default from Outreach settings (design null), or its own look,
 * accent and button shape. Touching any control while on the default starts this mail's own design
 * from the default's values.
 */
const DesignPanel: FC<{ design: MailDesign | null | undefined; brand: MailDesign | null; onChange: (design: MailDesign | null) => void }> = ({ design, brand, onChange }) => {
  const usingBrand = !design;
  const current = resolveDesign(design, brand);
  const set = <K extends keyof MailDesign>(key: K, value: MailDesign[K]) => onChange({ ...current, [key]: value });
  const brandText = brand ? `${LOOK_LABELS[brand.look]}, ${ACCENT_LABELS[brand.accent].toLowerCase()}, ${BUTTON_SHAPE_LABELS[brand.button].toLowerCase()} buttons` : "Loading the brand default...";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Switch checked={usingBrand} onChange={(on) => onChange(on ? null : { ...current })} label="Use the brand default" />
        <div className="min-w-0 text-xs">
          <p className="text-sm font-semibold">Use the brand default</p>
          <p className="text-gray-500">
            {brandText}.{" "}
            <Link href="/heroshima/outreach/settings" target="_blank" className="font-semibold text-black underline">
              Change it
            </Link>
          </p>
        </div>
      </div>

      <fieldset className={cn("flex flex-col gap-2", usingBrand && "opacity-70")}>
        <legend className="mb-2 text-xs font-semibold text-gray-600">Look</legend>
        <div role="radiogroup" aria-label="Look" className="grid grid-cols-3 gap-2">
          {MAIL_LOOKS.map((look) => {
            const on = current.look === look;
            return (
              <button
                key={look}
                type="button"
                role="radio"
                aria-checked={on}
                title={LOOK_NOTES[look]}
                onClick={() => set("look", look)}
                className={cn("flex flex-col gap-1.5 rounded-md border p-1.5 text-left", on ? "border-black" : "border-gray-300 hover:border-gray-500")}>
                <LookSketch look={look} design={{ ...current, look }} />
                <span className="px-0.5 text-xs font-bold">{LOOK_LABELS[look]}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500">{LOOK_NOTES[current.look]}.</p>
      </fieldset>

      <fieldset className={cn(usingBrand && "opacity-70")}>
        <legend className="mb-2 text-xs font-semibold text-gray-600">Accent</legend>
        <div role="radiogroup" aria-label="Accent" className="flex flex-wrap gap-3">
          {MAIL_ACCENTS.map((accent) => {
            const c = ACCENT_COLORS[accent];
            const on = current.accent === accent;
            return (
              <button key={accent} type="button" role="radio" aria-checked={on} onClick={() => set("accent", accent)} className="flex flex-col items-center gap-1">
                <span
                  className={cn("block h-8 w-8 rounded-full border-2", on ? "ring-2 ring-black ring-offset-2" : "")}
                  style={{ background: c.fill, borderColor: c.edge } as CSSProperties}
                />
                <span className={cn("text-[11px]", on ? "font-bold text-black" : "text-gray-600")}>{ACCENT_LABELS[accent]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className={cn(usingBrand && "opacity-70")}>
        <legend className="mb-2 text-xs font-semibold text-gray-600">Buttons</legend>
        <Segmented label="Button shape" value={current.button} onChange={(b) => set("button", b)} options={MAIL_BUTTON_SHAPES.map((b) => ({ value: b, label: BUTTON_SHAPE_LABELS[b] }))} />
      </fieldset>

      <div className="rounded-md border border-gray-200 bg-[#f9f8f1] p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">Sample</p>
        <div className="flex flex-col gap-4">
          <MailButton design={current} label="Open my dashboard" size="sm" />
          <OfferBox design={current} kicker="Your personal offer" headline="20% off" detail="Code THEO20, valid until Friday" button="Use my discount" size="sm" />
        </div>
      </div>
    </div>
  );
};

/** A tiny drawing of a look: the card, its top (wordmark, band or nothing), two lines and a button. */
const LookSketch: FC<{ look: MailLook; design: MailDesign }> = ({ look, design }) => {
  const c = ACCENT_COLORS[design.accent] ?? ACCENT_COLORS.lime;
  return (
    <span aria-hidden className="block overflow-hidden rounded bg-[#f9f8f1] p-1.5">
      <span className={cn("block overflow-hidden bg-white", look === "letter" ? "rounded-sm" : "rounded border border-black/10")}>
        {look === "bold" ? <span className="block h-2.5" style={{ background: c.fill }} /> : null}
        <span className="flex flex-col gap-1 p-1.5">
          {look === "brand" ? <span className="mx-auto block h-1 w-5 rounded bg-[#222325]" /> : null}
          <span className="block h-1 w-full rounded bg-gray-300" />
          <span className="block h-1 w-2/3 rounded bg-gray-200" />
          <span
            className={cn("mt-0.5 block h-2 w-8", look === "letter" ? "" : "br-shadow")}
            style={{ "--br-c": c.edge, background: c.fill, borderColor: c.edge, borderWidth: 1, borderRadius: design.button === "round" ? 999 : 2 } as CSSProperties}
          />
        </span>
      </span>
    </span>
  );
};

export default DesignPanel;
