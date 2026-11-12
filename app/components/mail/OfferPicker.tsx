"use client";

import type { FC } from "react";
import Link from "next/link";
import type { MailOffer, OfferChoice } from "@/app/lib/mail/types";
import { INPUT, INPUT_SM } from "./ui";
import { numOrUndef, offerChoiceProblem, offerLabel } from "./format";

/**
 * An optional personal discount on a send: the offer, then `[ percent ]% valid for [ hours ]`
 * overrides for this send only (empty keeps the offer's own numbers).
 */
const OfferPicker: FC<{
  offers: MailOffer[];
  value: OfferChoice | null | undefined;
  onChange: (value: OfferChoice | null) => void;
  maxDiscountPercent: number;
}> = ({ offers, value, onChange, maxDiscountPercent }) => {
  const live = offers.filter((o) => !o.archived || o.id === value?.offerId);
  const offer = value ? offers.find((o) => o.id === value.offerId) : undefined;
  const problem = offerChoiceProblem(value, offers, maxDiscountPercent);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Offer"
          className={`${INPUT} max-w-xs`}
          value={value?.offerId ?? ""}
          onChange={(e) => onChange(e.target.value ? { offerId: e.target.value } : null)}>
          <option value="">No offer</option>
          {live.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({offerLabel(o)}, {o.validHours} h)
            </option>
          ))}
        </select>
        {!live.length ? (
          <Link href="/heroshima/outreach/offers/new" className="text-xs font-semibold hover:underline">
            Make an offer
          </Link>
        ) : null}
      </div>
      {value && offer ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {offer.kind === "percent" ? (
            <>
              <input
                type="number"
                min={1}
                max={maxDiscountPercent}
                aria-label="Discount percent"
                className={`${INPUT_SM} w-20 tabular-nums`}
                placeholder={String(offer.percentOff ?? "")}
                value={value.percentOverride ?? ""}
                onChange={(e) => onChange({ ...value, percentOverride: numOrUndef(e.target.value) })}
              />
              <span>% valid for</span>
            </>
          ) : (
            <span>{offerLabel(offer)} off, valid for</span>
          )}
          <input
            type="number"
            min={1}
            aria-label="Valid for hours"
            className={`${INPUT_SM} w-20 tabular-nums`}
            placeholder={String(offer.validHours)}
            value={value.validHoursOverride ?? ""}
            onChange={(e) => onChange({ ...value, validHoursOverride: numOrUndef(e.target.value) })}
          />
          <span>hours</span>
          <span className="text-xs text-gray-500">Empty keeps the offer&apos;s numbers.</span>
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className="text-xs text-[#b23c26]">
          {problem}
        </p>
      ) : null}
    </div>
  );
};

export default OfferPicker;
