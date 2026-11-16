"use client";

import { useMemo, type FC } from "react";
import { LoaderCircle } from "lucide-react";
import { OFFER_COPY_DEFAULTS, type MailDesign, type TemplateContent } from "@/app/lib/mail/types";
import MailFrame from "./MailFrame";
import OfferBox from "./OfferBox";
import { resolveDesign } from "./blocks";
import { usePreview } from "./usePreview";

/**
 * An offer as it looks in a mail: the mail service renders one offer box (the brand default look)
 * with a sample code, the headline carrying this offer's own discount. If the render fails, the box
 * is drawn here instead.
 */
const OfferSample: FC<{ discount: string; brandDesign: MailDesign | null }> = ({ discount, brandDesign }) => {
  const headline = `${discount} off`;
  const content = useMemo<TemplateContent>(
    () => ({ subject: "Your personal offer", preview: "", blocks: [{ type: "offer", headline }], sender: "brand", pref: null, feedbackFooter: false, design: null }),
    [headline],
  );
  const preview = usePreview({ content, sampleOffer: true });

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
              kicker={OFFER_COPY_DEFAULTS.kicker}
              headline={headline}
              detail="Code THEO20, valid until Friday"
              button={OFFER_COPY_DEFAULTS.button}
            />
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-gray-500">Drawing the offer...</p>
        )}
      </div>
      <p className="text-[11px] text-gray-500">
        {preview.error ? "Drawn here: the mail service didn't answer. " : ""}The code and end time are samples; each mail fills in its own. The words come from the mail&apos;s offer box.
      </p>
    </div>
  );
};

export default OfferSample;
