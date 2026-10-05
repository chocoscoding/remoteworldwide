"use client";

// Google Analytics, loaded only after someone says yes to analytics cookies.
//
// Google's Consent Mode is told "denied" for everything first, so nothing GA does can set a cookie
// before a choice. `gtag.js` itself is not even requested until the choice is "analytics: true";
// then consent is granted and the page is configured. Taking it back later denies it again and
// expires GA's cookies. Vercel Analytics and Speed Insights set no cookies, so they stay in the
// layout untouched.
//
// The measurement id comes from the server layout as a prop: it is not a NEXT_PUBLIC variable.

import { useEffect, useRef, type FC } from "react";
import Script from "next/script";
import { clearAnalyticsCookies, useConsent } from "@/app/lib/consent/consent";

type GtagWindow = Window & { dataLayer?: unknown[] };

/** Google's own snippet, typed: it queues an Arguments object, which is what gtag.js reads off the queue. */
function gtag(...args: unknown[]): void {
  void args;
  const w = window as GtagWindow;
  w.dataLayer = w.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments);
}

const ConsentScripts: FC<{ gaId?: string }> = ({ gaId }) => {
  const consent = useConsent();
  const granted = consent?.analytics === true;
  const defaulted = useRef(false);
  const configured = useRef(false);

  useEffect(() => {
    // Not known yet (hydration): wait, rather than clear cookies someone already agreed to.
    if (consent === undefined || !gaId) return;
    if (!defaulted.current) {
      gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
      defaulted.current = true;
    }
    if (granted) {
      gtag("consent", "update", { analytics_storage: "granted" });
      if (!configured.current) {
        gtag("js", new Date());
        gtag("config", gaId);
        configured.current = true;
      }
      return;
    }
    if (configured.current) gtag("consent", "update", { analytics_storage: "denied" });
    // Undecided or declined: no GA cookie stays behind, including ones from before this card existed.
    clearAnalyticsCookies();
  }, [consent, granted, gaId]);

  if (!gaId || !granted) return null;
  return <Script id="google-analytics" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} />;
};

export default ConsentScripts;
