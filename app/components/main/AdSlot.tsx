"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FC } from "react";
import { cn } from "@/lib/utils";
// eslint-disable-next-line unused-imports/no-unused-imports, @typescript-eslint/no-unused-vars -- ADVERTISE_HREF is used by the commented-out "Want your ads here?" link
import { ADVERTISE_HREF, adsenseUnit, type AdSlotName, type SlotAnswer } from "@/app/lib/ads/types";
import GoogleAd from "./GoogleAd";

// One ad placement. It asks the backend about this slot (GET /api/ads?slot=): whether this viewer
// gets ads at all (signed out or Free; never Basic and up) and the slot's custom ad if the admin has
// one running (/heroshima/ads). A custom ad takes the slot; otherwise it shows the slot's Google
// AdSense unit (GoogleAd.tsx), when one is configured. No ads for this viewer, or nothing to show,
// and the slot renders nothing at all. Under whatever it shows sits "Want your ads here?", which
// opens an email to us.
//
// A custom ad's view is counted once half of it has been on screen, and a press as it opens the
// advertiser's page in a new tab. Google counts its own.
//
// Placed on /jobs (tall boxes either side, a banner under the list) and on a job's page (under its
// tools). Until the AdSense ids are set, a slot with no custom ad shows nothing in production.

const beacon = (url: string) => {
  try {
    if (navigator.sendBeacon?.(url)) return;
    void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    /* Counting must never get in the way of the page. */
  }
};

// How a slot is shaped. "box" is a square-ish block; "tall" stands the height of the screen beside the
// jobs list and stays put while it scrolls; "banner" is a wide strip under the list.
type AdShape = "box" | "tall" | "banner";
const SHAPE: Record<AdShape, { frame: string; format: "auto" | "vertical" | "horizontal" }> = {
  box: { frame: "min-h-[250px]", format: "auto" },
  tall: { frame: "h-[calc(100vh-150px)] min-h-[400px]", format: "vertical" },
  banner: { frame: "h-[90px] md:h-[120px]", format: "horizontal" },
};

// `only` keeps a slot to phones or to tablet and up (the site's md breakpoint). It is decided here
// rather than with CSS so a slot that isn't on screen never asks for an ad or loads Google into a
// box with no width.
const PHONE = "(max-width: 767px)";
const subscribePhone = (change: () => void) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};
const usePhone = () => useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => null);

const AdSlot: FC<{ slot: AdSlotName; className?: string; shape?: AdShape; only?: "mobile" | "desktop" }> = ({ slot, only, ...rest }) => {
  const phone = usePhone();
  if (only && (phone === null || phone !== (only === "mobile"))) return null;
  return <AdBox slot={slot} {...rest} />;
};

const AdBox: FC<{ slot: AdSlotName; className?: string; shape?: AdShape }> = ({ slot, className, shape = "box" }) => {
  const { frame, format } = SHAPE[shape];
  const [answer, setAnswer] = useState<SlotAnswer | null>(null);
  const box = useRef<HTMLElement>(null);
  const ad = answer?.ad ?? null;
  const unit = adsenseUnit(slot);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ads?slot=${encodeURIComponent(slot)}`, { credentials: "same-origin", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: SlotAnswer | null } | null) => setAnswer(body?.data ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, [slot]);

  useEffect(() => {
    const node = box.current;
    if (!ad || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        beacon(`/api/ads/${encodeURIComponent(ad.id)}/impression`);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ad]);

  // In local development a slot with nothing to fill it still shows its box, so the layout can be
  // checked without AdSense ids. Production never renders this.
  const preview = !ad && !unit && process.env.NODE_ENV === "development";
  if (!answer?.show || (!ad && !unit && !preview)) return null;

  return (
    <aside ref={box} aria-label="Advertisement" data-ad-slot={slot} className={cn("w-full", shape === "tall" && "sticky top-[85px] self-start", className)}>
      {ad ? (
        <>
          <a
            href={ad.linkUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            onClick={() => beacon(`/api/ads/${encodeURIComponent(ad.id)}/click`)}
            className={cn("block overflow-hidden rounded-md border border-primary/10 bg-white", shape !== "box" && frame)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the advertiser's own image host, not ours to optimise */}
            <img src={ad.imageUrl} alt={ad.alt} className={cn("block w-full", shape === "box" ? "h-auto" : "h-full object-cover")} loading="lazy" />
          </a>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/40">
            {ad.advertiser ? `Sponsored by ${ad.advertiser}` : "Sponsored"}
          </p>
        </>
      ) : preview ? (
        <div className={cn("flex w-full items-center justify-center rounded-md border border-dashed border-primary/25 bg-primary/[0.03] p-3 text-center text-xs font-semibold text-primary/45", frame)}>
          Google ad ({slot})
          <br />
          dev preview, no AdSense ids set
        </div>
      ) : (
        <GoogleAd unit={unit as string} format={format} className={cn("w-full", frame)} />
      )}
      {/* Switched off for now (owner, 2026-10-28): uncomment to offer advertising by email again.
      <a href={ADVERTISE_HREF} className="mt-1 block text-left text-[11px] italic text-primary/55 underline underline-offset-2 hover:text-primary">
        Want your ads here?
      </a> */}
    </aside>
  );
};

export default AdSlot;
