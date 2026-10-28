"use client";

import { useEffect, useRef, useState, type FC } from "react";
import { cn } from "@/lib/utils";
import type { AdSlotName, PublicAd } from "@/app/lib/ads/types";

// One ad placement. It asks the backend for this slot's ad (GET /api/ads?slot=), which answers
// nothing to Basic and up and nothing when no ad is running, and then the slot renders nothing at
// all. A view is counted once, when at least half of it has been on screen; a press is counted as
// it opens the advertiser's page in a new tab. The admin places ads at /heroshima/ads.
//
// The slots on the pages are commented out until ads go live (owner, 2026-10-28): uncomment an
// `<AdSlot slot=… />` and it shows whatever the admin has running for it.

const beacon = (url: string) => {
  try {
    if (navigator.sendBeacon?.(url)) return;
    void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    /* Counting must never get in the way of the page. */
  }
};

const AdSlot: FC<{ slot: AdSlotName; className?: string; sticky?: boolean }> = ({ slot, className, sticky = false }) => {
  const [ad, setAd] = useState<PublicAd | null>(null);
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ads?slot=${encodeURIComponent(slot)}`, { credentials: "same-origin", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: PublicAd | null } | null) => setAd(body?.data ?? null))
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

  if (!ad) return null;

  return (
    <aside
      ref={box}
      aria-label="Advertisement"
      data-ad-slot={slot}
      className={cn("w-full", sticky && "sticky top-[85px] self-start", className)}>
      <a
        href={ad.linkUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => beacon(`/api/ads/${encodeURIComponent(ad.id)}/click`)}
        className="block overflow-hidden rounded-md border border-primary/10 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- the advertiser's own image host, not ours to optimise */}
        <img src={ad.imageUrl} alt={ad.alt} className="block h-auto w-full" loading="lazy" />
      </a>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/40">
        {ad.advertiser ? `Sponsored by ${ad.advertiser}` : "Sponsored"}
      </p>
    </aside>
  );
};

export default AdSlot;
