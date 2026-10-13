import type { FC } from "react";
import { cn } from "@/lib/utils";

/**
 * A pod member's face: their photo, or their initials on a colour of their own. "You" is always ink
 * with lime initials, so you find yourself at a glance in the stack, the feed and the board.
 *
 * The colour comes from the name, so the same person keeps it on every surface and every visit.
 */
const COLOURS = ["#6c7a1e", "#2f55c4", "#b23c26", "#7a4fb8", "#0f7b6c", "#c26a1b", "#4b5563"];

export const initialsOf = (name: string): string =>
  name === "You"
    ? "ME"
    : name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";

function colourOf(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLOURS[hash % COLOURS.length];
}

export interface PodAvatarProps {
  name: string;
  image?: string | null;
  /** Pixel size; the initials scale with it. */
  size?: number;
  className?: string;
}

const PodAvatar: FC<PodAvatarProps> = ({ name, image = null, size = 28, className }) => {
  const me = name === "You";
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)), background: me ? "#222325" : colourOf(name) }}
      className={cn(
        "grid flex-none place-content-center overflow-hidden rounded-full font-extrabold leading-none",
        me ? "text-[#e1f073]" : "text-white",
        className,
      )}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
};

export default PodAvatar;
