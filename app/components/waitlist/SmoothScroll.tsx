"use client";

import type { FC, ReactNode } from "react";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

/**
 * Smooth scrolling for /waitlist (Lenis, owner 2026-10-01). It drives the window's own scroll, so
 * the pinned chapter list, the scroll-linked story and the floating Join pill go on reading native
 * scroll positions. Mounted by this page only, so it goes when you leave it. Lenis honours
 * prefers-reduced-motion by default: scrolling then tracks the wheel 1:1.
 */
const SmoothScroll: FC<{ children: ReactNode }> = ({ children }) => (
  <ReactLenis root options={{ lerp: 0.1 }}>
    {children}
  </ReactLenis>
);

export default SmoothScroll;
