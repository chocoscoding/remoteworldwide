"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

// A <Link> that prefetches only once the pointer (or a finger) is on it.
//
// A plain <Link> prefetches every route that scrolls into view, so one visitor
// scrolling a job list fires a request per card (and per company link on it):
// each one a server render, each one counted against the firewall's per-IP rate
// limit. List cards use this instead; navigation stays client-side and the
// route is still warm by the time the click lands.
export default function HoverPrefetchLink({ onMouseEnter, onTouchStart, prefetch, ...props }: ComponentProps<typeof Link>) {
  const [active, setActive] = useState(false);
  return (
    <Link
      {...props}
      prefetch={active ? (prefetch ?? null) : false}
      onMouseEnter={(e) => {
        setActive(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setActive(true);
        onTouchStart?.(e);
      }}
    />
  );
}
