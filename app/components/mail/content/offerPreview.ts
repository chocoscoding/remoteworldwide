import {
  DEFAULT_OFFER_LINK,
  DEFAULT_OFFER_LOOK,
  OFFER_VALID_HOURS_MAX,
  type MailOffer,
  type OfferChoice,
  type OfferSampleAsk,
  type TemplateContent,
} from "@/app/lib/mail/types";

/** "20%" or "$5", as the backend labels a code (offerService discountLabelOf); a percent override wins. */
export const offerDiscountLabel = (offer: Pick<MailOffer, "kind" | "percentOff" | "amountOffCents">, percentOverride?: number | null): string => {
  const percent = percentOverride ?? (offer.kind === "percent" ? offer.percentOff : null);
  if (typeof percent === "number") return `${percent}%`;
  const cents = offer.amountOffCents ?? 0;
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
};

/**
 * An offer as the preview draws it (with a campaign's overrides): its discount, how long its code
 * lasts, its box's look (countdown included) and where its button goes. The code stays a sample.
 */
export const offerSampleOf = (offer: MailOffer, choice?: Pick<OfferChoice, "percentOverride" | "validHoursOverride"> | null): OfferSampleAsk => ({
  discountLabel: offerDiscountLabel(offer, choice?.percentOverride),
  validHours: Math.min(OFFER_VALID_HOURS_MAX, Math.max(1, Math.round(choice?.validHoursOverride ?? offer.validHours) || 72)),
  look: offer.look ?? DEFAULT_OFFER_LOOK,
  link: offer.link ?? DEFAULT_OFFER_LINK,
});

/** The live offers, last changed first: the editor previews with the first unless told otherwise. */
export const liveOffers = (offers: MailOffer[]): MailOffer[] => {
  const time = (at: MailOffer["updatedAt"]) => (at ? new Date(at).getTime() || 0 : 0);
  return offers.filter((o) => !o.archived).sort((a, b) => time(b.updatedAt ?? b.createdAt) - time(a.updatedAt ?? a.createdAt));
};

/** Whether the mail draws an offer: an offer box, or an {{offer...}} variable anywhere (the events service's rule). */
export const usesOffer = (content: TemplateContent): boolean =>
  content.blocks.some((block) => block.type === "offer") || /\{\{\s*offer/.test(JSON.stringify(content));
