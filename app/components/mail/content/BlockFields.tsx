"use client";

import type { FC, ReactNode } from "react";
import Link from "next/link";
import { OFFER_COPY_DEFAULTS, OFFER_COPY_MAX, type Block } from "@/app/lib/mail/types";
import { Notice } from "../ui";
import Fold from "./Fold";
import TextField from "./TextField";
import { OFFERS_HREF } from "./blocks";

/** What the offer block's inspector knows about the offer around it (a campaign has one; a template doesn't). */
export type OfferContext = {
  /** The campaign's own offer picker, shown at the top of the offer block. */
  picker?: ReactNode;
  /** Where "Discount rules" leads: the chosen offer's page, else the offers list. */
  href?: string;
};

const NOTES: Partial<Record<Block["type"], string>> = {
  divider: "A thin line between parts of the mail.",
  signature: "Theo's sign-off. The name comes from Outreach settings.",
  feedback: "\"How is it going?\" with four faces. Each tap is recorded with the mail.",
};

const LINK_PRESETS = [
  { label: "Dashboard", url: "{{appUrl}}/dashboard" },
  { label: "Pricing", url: "{{appUrl}}/pricing" },
  { label: "Offer link", url: "{{offerUrl}}" },
];

/** The fields of one block, by type. The inspector and the plain list form both use it. */
const BlockFields: FC<{ block: Block; onChange: (block: Block) => void; offer?: OfferContext }> = ({ block, onChange, offer }) => {
  switch (block.type) {
    case "heading":
      return <TextField label="Heading" value={block.text} maxLength={200} onChange={(text) => onChange({ ...block, text })} placeholder="Hi {{firstName|there}}" />;
    case "paragraph":
      return (
        <TextField
          label="Text"
          multiline
          value={block.text}
          maxLength={5000}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="Write the paragraph."
          hint="**bold** · [label](https://...) · a blank line starts a new paragraph"
        />
      );
    case "button":
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Button text" value={block.label} maxLength={80} onChange={(label) => onChange({ ...block, label })} placeholder="Open my dashboard" />
          <div className="flex flex-col gap-1.5">
            <TextField label="Link" value={block.url} maxLength={500} onChange={(url) => onChange({ ...block, url })} placeholder="{{appUrl}}/dashboard" />
            <div className="flex flex-wrap gap-1">
              {LINK_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChange({ ...block, url: p.url })}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${block.url === p.url ? "border-black bg-black text-[#e1f073]" : "border-gray-300 text-gray-600 hover:border-black"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    case "image":
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Image address (https)" vars={false} value={block.src} maxLength={500} onChange={(src) => onChange({ ...block, src })} placeholder="https://..." />
          <TextField label="Description" vars={false} value={block.alt} maxLength={200} onChange={(alt) => onChange({ ...block, alt })} hint="Read aloud by screen readers, shown when images are off." />
          <TextField label="Link (optional)" value={block.href ?? ""} maxLength={500} onChange={(href) => onChange({ ...block, href: href || undefined })} />
        </div>
      );
    case "offer":
      return <OfferFields block={block} onChange={onChange} offer={offer} />;
    default:
      return <p className="text-sm text-gray-600">{NOTES[block.type]}</p>;
  }
};

type OfferBlock = Extract<Block, { type: "offer" }>;
type CopyKey = "kicker" | "headline" | "button";

/** The offer box: the campaign's offer (when there is one), then its three lines of copy. */
const OfferFields: FC<{ block: OfferBlock; onChange: (block: Block) => void; offer?: OfferContext }> = ({ block, onChange, offer }) => {
  const set = (key: CopyKey, value: string) => {
    const next: OfferBlock = { ...block };
    if (value) next[key] = value;
    else delete next[key];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      {offer?.picker ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-gray-600">Offer</p>
          {offer.picker}
        </div>
      ) : (
        <Notice className="text-xs">The offer comes from the campaign or playbook step. The preview shows a sample: 20% off, valid 72 hours.</Notice>
      )}
      <TextField label="Small line" value={block.kicker ?? ""} maxLength={OFFER_COPY_MAX.kicker} placeholder={OFFER_COPY_DEFAULTS.kicker} onChange={(v) => set("kicker", v)} />
      <TextField label="Headline" value={block.headline ?? ""} maxLength={OFFER_COPY_MAX.headline} placeholder={OFFER_COPY_DEFAULTS.headline} onChange={(v) => set("headline", v)} />
      <TextField label="Button text" value={block.button ?? ""} maxLength={OFFER_COPY_MAX.button} placeholder={OFFER_COPY_DEFAULTS.button} onChange={(v) => set("button", v)} />
      <p className="text-[11px] text-gray-500">Empty lines use the text shown in grey. The code and its end time are added under the headline.</p>
      <Fold title="Discount rules" variant="line" className="border-t border-gray-200 pt-1">
        <p className="text-xs text-gray-600">
          How much, how long the code lasts, which plans and the monthly cap are set on the offer, not in the mail.{" "}
          <Link href={offer?.href ?? OFFERS_HREF} target="_blank" className="font-semibold text-black underline">
            {offer?.href ? "Open the offer" : "See the offers"}
          </Link>
        </p>
      </Fold>
    </div>
  );
};

export default BlockFields;
