"use client";

import type { FC, ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { JOIN_LOOKS } from "@/app/components/waitlist/JoinLink";
import { signupWithNext } from "@/app/lib/next-url";

// The tool pages' calls to action. Signed out, they lead to signup and on to the tool. Signed in,
// they open the tool itself. Until the session is known they render the signed-out version, so
// the static page never flashes a button it has to take back.

const BASE =
  "group inline-flex items-center justify-center gap-2 transition-[transform,box-shadow,text-decoration-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const ToolCta: FC<{
  href: string;
  openLabel: string;
  look?: keyof typeof JOIN_LOOKS;
  className?: string;
  children?: ReactNode;
}> = ({ href, openLabel, look = "ink", className, children }) => {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  return (
    <Link href={signedIn ? href : signupWithNext(href)} className={cn(BASE, JOIN_LOOKS[look], className)}>
      {signedIn ? openLabel : (children ?? "Get started")}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
};

/** The hero's action: the way into the tool, with a note for someone already signed in. */
export const ToolHeroAction: FC<{ href: string; openLabel: string; tone?: "light" | "dark"; className?: string }> = ({ href, openLabel, tone = "light", className }) => {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  return (
    <div className={cn("mt-8 flex flex-wrap items-center gap-4", className)}>
      <Link href={signedIn ? href : signupWithNext(href)} className={cn(BASE, tone === "dark" ? JOIN_LOOKS.lime : JOIN_LOOKS.ink)}>
        {signedIn ? openLabel : "Get started"}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
      {signedIn ? <span className={cn("text-sm", tone === "dark" ? "text-white/70" : "text-primary/60")}>You&apos;re signed in.</span> : null}
    </div>
  );
};
