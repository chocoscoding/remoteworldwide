"use client";

import { useMemo, type FC } from "react";
import { LoaderCircle } from "lucide-react";
import {
  DEFAULT_OFFER_LINK,
  OFFER_COPY_DEFAULTS,
  OFFER_PATH_MAX,
  OFFER_PATH_PATTERN,
  OFFER_VALID_HOURS_MAX,
  type MailDesign,
  type OfferLink,
  type OfferLook,
  type OfferSampleAsk,
  type TemplateContent,
} from "@/app/lib/mail/types";
import MailFrame from "./MailFrame";
import OfferBox from "./OfferBox";
import { resolveDesign } from "./blocks";
import { usePreview } from "./usePreview";

/** "72 hours", "7 days". */
const validForText =(hours: number) => (hours >= 48 && hours % 24 === 0 ? `${hours / 24} days` : `${hours} ${hours === 1 ? "hour" : "hours"}`);

/** A link the sample can send while the form is mid-edit: an unfinished path draws as the billing page. */
const sampleLink = (link: OfferLink): OfferLink =>
  link.kind !== "path" ? { kind: link.kind } : link.path && link.path.length <= OFFER_PATH_MAX && OFFER_PATH_PATTERN.test(link.path) ? link : DEFAULT_OFFER_LINK;

/**
 * An offer as it looks in a mail: the mail service renders one offer box (the brand default look)
 * from the form as it stands (discount, validity, look and link), with a sample code. If the render
 * fails, the box is drawn here instead, following the same look.
 */
const OfferSample: FC<{ discount: string; validHours: number; look: OfferLook; link: OfferLink; brandDesign: MailDesign | null }> = ({
  discount,
  validHours,
  look,
  link,
  brandDesign,
}) => {
  const headline = `${discount} off`;
  const hours = Math.min(OFFER_VALID_HOURS_MAX, Math.max(1, Math.round(Number(validHours) || 72)));
  const content = useMemo<TemplateContent>(
    () => ({ subject: "Your personal offer", preview: "", blocks: [{ type: "offer", headline }], sender: "brand", pref: null, feedbackFooter: false, design: null }),
    [headline],
  );
  const offerSample: OfferSampleAsk = { discountLabel: discount, validHours: hours, look, link: sampleLink(link) };
  const preview = usePreview({ content, sampleOffer: true, offerSample });

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-100 p-3">
        {preview.loading ? <LoaderCircle className="absolute right-3 top-3 z-10 h-4 w-4 animate-spin text-gray-500" aria-label="Updating" /> : null}
        {preview.rendered && !preview.error ? (
          <MailFrame html={preview.rendered.html} width={560} minHeight={300} title="The offer in a mail" />
        ) : preview.error ? (
          <div className="bg-[#f9f8f1] p-6">
            <OfferBox
              design={resolveDesign(null, brandDesign)}
              look={look}
              kicker={OFFER_COPY_DEFAULTS.kicker}
              headline={headline}
              code="THEO20"
              detail={`valid for ${validForText(hours)}`}
              button={OFFER_COPY_DEFAULTS.button}
            />
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-gray-500">Drawing the offer...</p>
        )}
      </div>
      {preview.error ? <p className="text-[11px] text-gray-500">Drawn here: the mail service didn&apos;t answer.</p> : null}
    </div>
  );
};

export default OfferSample;
