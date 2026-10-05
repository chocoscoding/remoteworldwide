"use client";

import type { FC, ReactNode } from "react";
import { ArrowUp } from "lucide-react";
import { useLenis } from "lenis/react";
import { cn } from "@/lib/utils";
import { goToJoin } from "./joinedStore";

/** Shared with the tool pages' ToolCta, so a signed-in "Open the tool" button looks the same as "Join". */
export const JOIN_LOOKS = {
  // The page's main call to action: flat ink, a lime hard shadow only on hover.
  ink: "h-12 rounded-xl bg-primary px-6 text-sm font-bold text-white br-plain-press br-lime focus-visible:ring-primary",
  // On dark panels and as the lime moment of a section: ink outline and hard shadow, pressed on click.
  lime: "h-12 rounded-xl bg-secondary px-6 text-sm font-bold text-primary br-shadow-press focus-visible:ring-primary",
  // Inline, inside copy.
  text: "min-h-[44px] text-sm font-bold text-primary underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary focus-visible:ring-primary",
} as const;
const LOOKS = JOIN_LOOKS;

/**
 * Every "Join the waitlist" on /waitlist. A plain `#join` link underneath, so it still reaches the
 * form without JavaScript; with it, the page glides there and the cursor lands in the email field.
 */
const JoinLink: FC<{ look?: keyof typeof LOOKS; className?: string; children?: ReactNode }> = ({ look = "ink", className, children = "Join the waitlist" }) => {
  // The page's smooth scrolling, when it is on (app/components/waitlist/SmoothScroll.tsx).
  const lenis = useLenis();
  return (
    <a
      href="#join"
      onClick={(e) => {
        if (goToJoin(lenis)) e.preventDefault();
      }}
      className={cn(
        "group inline-flex items-center justify-center gap-2 transition-[transform,box-shadow,text-decoration-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        LOOKS[look],
        className,
      )}>
      {children}
      <ArrowUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" aria-hidden />
    </a>
  );
};

export default JoinLink;
