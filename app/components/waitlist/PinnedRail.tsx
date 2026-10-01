"use client";

import { useLayoutEffect, useRef, useSyncExternalStore, type FC, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/** Below md, where the steps would otherwise stack. */
const PHONE = "(max-width: 767px)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const isPhone = () => window.matchMedia(PHONE).matches;
const notOnServer = () => false;

/** The sticky navbar's height, plus a little air under it. */
const BELOW_NAV = 65 + 16;

/**
 * The early-access steps (owner, 2026-10-01). From md up they sit side by side. On a phone the
 * section (heading and cards) pins under the navbar and scrolling down slides the cards across,
 * one after another; once the last is in view it lets go. The pin lasts exactly as long as the
 * slide, so a pixel scrolled down is a pixel moved across. With reduced motion a phone gets a row
 * to swipe instead.
 */
const PinnedRail: FC<{ heading: ReactNode; items: ReactNode[] }> = ({ heading, items }) => {
  const phone = useSyncExternalStore(subscribe, isPhone, notOnServer);
  const reduce = useReducedMotion();
  const pinned = phone && !reduce;
  const runway = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLOListElement>(null);

  // How far the row has to travel, and the room to scroll it in: set on the DOM, re-measured when
  // the cards or the window change size.
  useLayoutEffect(() => {
    const outer = runway.current;
    const sticky = panel.current;
    const list = track.current;
    if (!outer || !sticky || !list) return;
    if (!pinned) {
      outer.style.height = "";
      sticky.style.top = "";
      return;
    }
    const measure = () => {
      const distance = Math.max(0, list.scrollWidth - list.clientWidth);
      sticky.style.top = `${Math.max(BELOW_NAV, Math.round((window.innerHeight - sticky.offsetHeight) / 2))}px`;
      outer.style.height = `${sticky.offsetHeight + distance}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sticky);
    observer.observe(list);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [pinned]);

  // Scrolled since the pin took hold, as distance across; worked out from where the runway sits.
  const { scrollY } = useScroll();
  const x = useTransform(scrollY, () => {
    if (!pinned || !runway.current || !panel.current || !track.current) return 0;
    const distance = Math.max(0, track.current.scrollWidth - track.current.clientWidth);
    const top = parseFloat(panel.current.style.top) || BELOW_NAV;
    return -Math.min(distance, Math.max(0, top - runway.current.getBoundingClientRect().top));
  });

  return (
    <div ref={runway}>
      {/* Full-bleed while pinned, so the cards slide off the screen's edge rather than a gutter's. */}
      <div ref={panel} className={cn(pinned && "sticky -mx-4 overflow-hidden px-4")}>
        {heading}
        <motion.ol
          ref={track}
          style={{ x }}
          className={cn(
            "flex gap-4 md:grid md:grid-cols-3 md:gap-6",
            !pinned && "max-md:-mx-4 max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto max-md:px-4 max-md:pb-2",
          )}>
          {items.map((item, i) => (
            <li key={i} className="w-[85%] flex-none snap-start md:w-auto">
              {item}
            </li>
          ))}
        </motion.ol>
      </div>
    </div>
  );
};

export default PinnedRail;
