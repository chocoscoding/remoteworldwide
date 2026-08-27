import { FC } from "react";
import { cn } from "@/lib/utils";

/**
 * Initials avatar. The same circle was hand-rolled in five places (referrals,
 * pod, invites, settings/profile, the sidebar); this is the shared one. The
 * other four are left alone for now — migrating them isn't this change.
 */
export interface AvatarProps {
  name: string;
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

const Avatar: FC<AvatarProps> = ({ name, size = "md", tone = "light", className }) => (
  <span
    aria-hidden="true"
    className={cn("grid flex-none place-content-center rounded-full font-bold", SIZES[size], TONES[tone], className)}>
    {initialsOf(name)}
  </span>
);

export default Avatar;
