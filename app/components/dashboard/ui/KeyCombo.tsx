"use client";

// A keyboard shortcut as keycaps: "Ctrl + A" on Windows and Linux, "⌘ + A" on a Mac (owner,
// 2026-10-04). `mod` is the platform's command key; any other key is printed as given.

import { useSyncExternalStore, type FC } from "react";
import { cn } from "@/lib/utils";

const noSubscription = () => () => {};

/** Apple keyboards: macOS, and iPadOS with a keyboard attached (it reports itself as a Mac). */
const onApple = (): boolean => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent);
};

/**
 * Whether the person is on an Apple keyboard. False on the server and through hydration, so
 * the first paint is the same everywhere; a Mac switches to ⌘ right after.
 */
export const useIsMac = (): boolean => useSyncExternalStore(noSubscription, onApple, () => false);

const Cap: FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <kbd title={title} className="rounded border border-black/20 bg-white px-1 py-px font-sans text-[11px] font-medium leading-none text-primary">
    {children}
  </kbd>
);

export interface KeyComboProps {
  /** The keys, in order. "mod" is Ctrl, or ⌘ on a Mac. */
  keys: string[];
  /** What the shortcut does, said after the caps ("select all"). */
  label?: string;
  className?: string;
}

const KeyCombo: FC<KeyComboProps> = ({ keys, label, className }) => {
  const mac = useIsMac();
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="inline-flex items-center">
          {key === "mod" ? <Cap title={mac ? "Command" : "Control"}>{mac ? "⌘" : "Ctrl"}</Cap> : <Cap>{key}</Cap>}
        </span>
      ))}
      {label && <span>{label}</span>}
    </span>
  );
};

export default KeyCombo;
