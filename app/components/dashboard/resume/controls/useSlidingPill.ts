"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/**
 * The dark pill under the selected option of a tab bar or a switch, sliding to
 * the next one when the choice changes (owner, 2026-10-04: the editor's tabs
 * and switches "slide").
 *
 * The pill is measured from the selected button rather than computed from an
 * index, so options of different widths ("AI Tools" with its icon beside
 * "Content") still land exactly. A ResizeObserver re-measures when the group
 * itself changes size (a narrow rail, a font that loaded late).
 *
 * Until the first measurement there is no pill (`style` is null), and the
 * caller paints the selected button itself — so the server render and the
 * first frame already show the choice, and nothing slides in from the left.
 * Inline style: the offsets are runtime measurements with no static class.
 */
export function useSlidingPill<K extends string>(selected: K) {
  const groupRef = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<K, HTMLElement>());
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const measure = useCallback(() => {
    const el = items.current.get(selected);
    if (!el) {
      setBox(null);
      return;
    }
    const next = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
    setBox((prev) =>
      prev && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height ? prev : next,
    );
  }, [selected]);

  useLayoutEffect(() => {
    measure();
    const group = groupRef.current;
    if (!group || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    items.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [measure]);

  /** Ref callback for each option's button. */
  const itemRef = useCallback(
    (key: K) => (el: HTMLElement | null) => {
      if (el) items.current.set(key, el);
      else items.current.delete(key);
    },
    [],
  );

  const style: CSSProperties | null = box ? { left: box.left, top: box.top, width: box.width, height: box.height } : null;
  return { groupRef, itemRef, style };
}
