"use client";

import { useEffect, useRef, type FC } from "react";
import { ADSENSE_CLIENT } from "@/app/lib/ads/types";
import { useConsent } from "@/app/lib/consent/consent";

// One Google AdSense unit. The AdSense script is added to the page once, the first time any unit
// renders, so a page with no ad slot (or a paying viewer, who is never sent one) never loads it.
// Without analytics consent Google is asked for non-personalised ads only. AdSense's own consent
// rules for the EEA and UK (a Google-certified consent banner) are set up in AdSense, not here.

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number };
  }
}

const SCRIPT_ID = "rww-adsense";

function loadScript(client: string) {
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

const GoogleAd: FC<{ unit: string; format?: "auto" | "vertical" | "horizontal"; className?: string }> = ({ unit, format = "auto", className }) => {
  const consent = useConsent();
  const pushed = useRef(false);

  useEffect(() => {
    // Wait until the consent choice can be read (undefined while hydrating).
    if (!ADSENSE_CLIENT || consent === undefined || pushed.current) return;
    pushed.current = true;
    window.adsbygoogle = window.adsbygoogle || [];
    if (!consent?.analytics) window.adsbygoogle.requestNonPersonalizedAds = 1;
    loadScript(ADSENSE_CLIENT);
    try {
      window.adsbygoogle.push({});
    } catch {
      /* An ad that fails to fill leaves the box empty; the page carries on. */
    }
  }, [consent]);

  if (!ADSENSE_CLIENT) return null;
  return (
    <ins
      className={`adsbygoogle block ${className ?? ""}`}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={unit}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
};

export default GoogleAd;
