"use client";

import { FC, useState } from "react";
import { cn } from "@/lib/utils";

/** Only a real web address goes into an <img>: logos are whatever the posting named. */
const logoSrc = (url: string | null | undefined): string | null => (url && /^https?:\/\//i.test(url) ? url : null);

/**
 * The hub tile is dark and 44px, the index row light and 36px. One prop, not a
 * `size` and a `tone` that would have to be kept in step at every call.
 */
const SURFACE = {
  hub: "h-11 w-11 rounded-xl bg-white/10 text-sm text-[#e1f073]",
  row: "h-9 w-9 rounded-lg bg-[#f0f0ea] text-[11px] text-black/60",
} as const;

/**
 * The company's logo when the linked job has one, its initials when it does
 * not — or when the logo fails to load, since a broken image reads worse than
 * no image. The failed URL is remembered rather than a boolean, so relinking
 * the job inside TrackDetailsDialog shows the new logo without the caller
 * having to remember a `key` (JobPickerModal.tsx:258 does it that way).
 */
const TrackMark: FC<{ mark: string; logo?: string | null; surface: "hub" | "row"; className?: string }> = ({ mark, logo, surface, className }) => {
  const [failed, setFailed] = useState<string | null>(null);
  const src = logoSrc(logo);
  return (
    <span aria-hidden="true" className={cn("flex-none flex items-center justify-center overflow-hidden font-extrabold", SURFACE[surface], className)}>
      {src && src !== failed ? (
        // A plain <img>, as in JobPickerModal.tsx and Avatar.tsx: logos come from
        // whatever host a posting names, and next/image would need every one of
        // them in remotePatterns. The white plate is load-bearing on the hub — a
        // dark monochrome wordmark on bg-white/10 over ink is invisible — and its
        // edge against the ink is the frame: a light border here would sit on
        // bg-white (border-box clip) and vanish into the plate.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(src)} className="h-full w-full rounded-[inherit] bg-white object-contain p-1" />
      ) : (
        mark
      )}
    </span>
  );
};

export default TrackMark;
