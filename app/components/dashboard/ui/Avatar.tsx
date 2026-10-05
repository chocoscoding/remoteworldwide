"use client";

import { FC, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Initials avatar with photo support. The same circle was hand-rolled in five
 * places (referrals, pod, invites, settings/profile, the sidebar); this is
 * the shared one.
 *
 * The photo is `src` when there is one; without it (undefined or null) the
 * circle shows the name's initials. A photo that fails to load falls back to
 * initials rather than a broken image: partial photo coverage is the normal
 * state, not an error.
 */
export interface AvatarProps {
  name: string;
  /** Photo URL. Omitted or null, the initials show. */
  src?: string | null;
  size?: "sm" | "md" | "lg";
  /** `dark` is the ink-on-lime treatment used when the avatar leads a panel. */
  tone?: "light" | "dark";
  className?: string;
}

const SIZES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-11 w-11 text-sm",
  lg: "h-12 w-12 text-base",
};

const TONES: Record<NonNullable<AvatarProps["tone"]>, string> = {
  light: "bg-[#f0f0ea] text-[#222325]",
  dark: "bg-[#222325] text-[#e1f073]",
};

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const Avatar: FC<AvatarProps> = ({ name, src, size = "md", tone = "light", className }) => {
  const [broken, setBroken] = useState(false);
  const photo = src ?? null;
  const showPhoto = photo !== null && !broken;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid flex-none place-content-center overflow-hidden rounded-full font-bold",
        SIZES[size],
        TONES[tone],
        className
      )}>
      {showPhoto ? (
        // Plain <img>, deliberately: a 32-48px avatar gains nothing from the
        // image optimizer, and next/image would force remote-pattern config
        // for every host a profile photo can come from.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
};

export default Avatar;
