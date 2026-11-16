"use client";

import type { CSSProperties, FC } from "react";
import { Check } from "lucide-react";
import {
  ACCENT_COLORS,
  ACCENT_LABELS,
  BUTTON_SHAPE_LABELS,
  LOOK_LABELS,
  MAIL_ACCENTS,
  MAIL_BUTTON_SHAPES,
  MAIL_LOOKS,
  OFFER_COPY_DEFAULTS,
  type MailDesign,
} from "@/app/lib/mail/types";
import { Segmented } from "@/app/components/mail/ui";
import { cn } from "@/lib/utils";

// The brand default look in Outreach settings: look, accent and button shape, beside a small live
// sample of a mail (a button and an offer box) drawn in HTML with the same accent colours the
// events renderer uses. Mails with a design of their own keep theirs.

const SAMPLE_DISCOUNT = "20%";
const fillDiscount = (text: string) => text.replace(/\{\{\s*offerDiscount[^}]*\}\}/g, SAMPLE_DISCOUNT);

const Heading: FC<{ children: string }> = ({ children }) => <p className="mb-1.5 text-xs font-semibold text-gray-600">{children}</p>;

const DesignPicker: FC<{ design: MailDesign; onChange: (design: MailDesign) => void }> = ({ design, onChange }) => {
  const set = <K extends keyof MailDesign>(key: K, value: MailDesign[K]) => onChange({ ...design, [key]: value });
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <div className="flex flex-col gap-5">
        <div>
          <Heading>Look</Heading>
          <Segmented label="Look" value={design.look} options={MAIL_LOOKS.map((l) => ({ value: l, label: LOOK_LABELS[l] }))} onChange={(v) => set("look", v)} />
        </div>
        <div>
          <Heading>Accent</Heading>
          <div role="radiogroup" aria-label="Accent" className="flex flex-wrap gap-2">
            {MAIL_ACCENTS.map((a) => {
              const c = ACCENT_COLORS[a];
              const on = design.accent === a;
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("accent", a)}
                  className={cn("flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-3 text-xs font-semibold", on ? "border-black text-black" : "border-gray-300 text-gray-700 hover:border-black")}>
                  <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: c.fill, border: `1px solid ${c.edge}` }}>
                    {on ? <Check className="h-3.5 w-3.5" style={{ color: c.text }} /> : null}
                  </span>
                  {ACCENT_LABELS[a]}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Heading>Button shape</Heading>
          <Segmented label="Button shape" value={design.button} options={MAIL_BUTTON_SHAPES.map((b) => ({ value: b, label: BUTTON_SHAPE_LABELS[b] }))} onChange={(v) => set("button", v)} />
        </div>
        <p className="text-xs text-gray-500">The look of every marketing mail without a design of its own. Product mail keeps the product look.</p>
      </div>
      <DesignSample design={design} />
    </div>
  );
};

const Wordmark: FC<{ color: string }> = ({ color }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold" style={{ color }}>
    <span aria-hidden className="inline-block h-4 w-4 rounded-[4px]" style={{ background: color }} />
    RemoteWorldwide
  </span>
);

/** A small mail in the chosen look: brand (the wordmark on white), letter (a plain note) or bold (an accent band up top). */
export const DesignSample: FC<{ design: MailDesign }> = ({ design }) => {
  const c = ACCENT_COLORS[design.accent] ?? ACCENT_COLORS.lime;
  const letter = design.look === "letter";
  const bold = design.look === "bold";
  const radius = design.button === "round" ? 999 : 6;
  // Brand and bold wear the hard shadow in the accent's edge colour (br-shadow, recoloured); letter stays flat.
  const hard = { borderColor: c.edge, "--br-c": c.edge } as CSSProperties;
  const button = (label: string) => (
    <span
      className={cn("inline-block px-4 py-2 text-xs font-bold", !letter && "br-shadow")}
      style={{ background: c.fill, color: c.text, borderRadius: radius, ...(letter ? { border: `1px solid ${c.edge}` } : hard) }}>
      {label} &rarr;
    </span>
  );

  return (
    <figure className="rounded-md bg-gray-50 p-3">
      <figcaption className="mb-2 text-xs font-semibold text-gray-500">Sample</figcaption>
      <div aria-hidden className="overflow-hidden rounded-lg border border-gray-200 bg-white text-[#222325]">
        {bold ? (
          <div className="px-5 pb-4 pt-4" style={{ background: c.fill, color: c.text }}>
            <Wordmark color={c.text} />
            <p className="mt-3 text-lg font-extrabold leading-tight">New roles this week</p>
          </div>
        ) : null}
        <div className="px-5 py-4">
          {design.look === "brand" ? <Wordmark color="#222325" /> : null}
          {!bold ? <p className={cn("font-extrabold leading-tight", letter ? "text-sm" : "mt-3 text-lg")}>New roles this week</p> : null}
          <p className="mt-2 text-xs leading-relaxed text-gray-700">Hi there, three remote roles match what you are looking for.</p>
          <div className="mt-3">{button("See the roles")}</div>
          <div
            className={cn("mt-4 px-4 py-3", !letter && "br-shadow")}
            style={letter ? { border: `1px solid ${c.edge}`, borderRadius: 10 } : { background: c.fill, color: c.text, borderRadius: 10, ...hard }}>
            <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-75">{fillDiscount(OFFER_COPY_DEFAULTS.kicker)}</p>
            <p className={cn("mt-0.5 font-extrabold leading-tight", letter ? "text-base" : "text-xl")}>{fillDiscount(OFFER_COPY_DEFAULTS.headline)}</p>
            <p className="mt-1 text-[11px] font-semibold">Code WELCOME20, valid for 48 hours</p>
          </div>
          <div className="mt-3">{button(fillDiscount(OFFER_COPY_DEFAULTS.button))}</div>
        </div>
        <p className="border-t border-gray-100 px-5 py-2 text-[10px] text-gray-400">Unsubscribe · Contact us</p>
      </div>
    </figure>
  );
};

export default DesignPicker;
