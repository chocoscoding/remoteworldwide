"use client";

import { Suspense, type FC, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import JoinLink, { JOIN_LOOKS } from "@/app/components/waitlist/JoinLink";
import WaitlistForm, { WaitlistFormFromParams } from "@/app/components/waitlist/WaitlistForm";

// The tool pages' calls to action. Signed out, they lead to the waitlist form in the page's hero
// (#join), as every signed-out CTA on the site does while spots open in batches. Signed in, they
// open the tool itself. Until the session is known they render the signed-out version, so the
// static page never flashes a button it has to take back.

const BASE =
  "group inline-flex items-center justify-center gap-2 transition-[transform,box-shadow,text-decoration-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

/** `waitlistHref` is for a page with no form of its own (/tools): signed out, it goes to /waitlist instead of #join. */
export const ToolCta: FC<{
  href: string;
  openLabel: string;
  look?: keyof typeof JOIN_LOOKS;
  className?: string;
  children?: ReactNode;
  waitlistHref?: string;
}> = ({ href, openLabel, look = "ink", className, children, waitlistHref }) => {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  if (signedIn || waitlistHref) {
    return (
      <Link href={signedIn ? href : waitlistHref!} className={cn(BASE, JOIN_LOOKS[look], className)}>
        {signedIn ? openLabel : (children ?? "Join the waitlist")}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    );
  }
  return (
    <JoinLink look={look} className={className}>
      {children}
    </JoinLink>
  );
};

/** Waitlist copy ("we're opening spots…"), which reads oddly to someone already signed in. */
export const SignedOutOnly: FC<{ children: ReactNode }> = ({ children }) => {
  const { status } = useSession();
  return status === "authenticated" ? null : children;
};

/** The hero's action: the waitlist form, or for someone signed in, the way into the tool. */
export const ToolHeroAction: FC<{ href: string; openLabel: string; tone?: "light" | "dark"; inputId?: string; className?: string }> = ({
  href,
  openLabel,
  tone = "light",
  inputId,
  className,
}) => {
  const { status } = useSession();
  if (status === "authenticated") {
    return (
      <div className={cn("mt-8 flex flex-wrap items-center gap-4", className)}>
        <Link href={href} className={cn(BASE, tone === "dark" ? JOIN_LOOKS.lime : JOIN_LOOKS.ink)}>
          {openLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <span className={cn("text-sm", tone === "dark" ? "text-white/70" : "text-primary/60")}>You&apos;re signed in.</span>
      </div>
    );
  }
  return (
    <Suspense fallback={<WaitlistForm initialPlan={null} tone={tone} inputId={inputId} className={className} />}>
      <WaitlistFormFromParams tone={tone} inputId={inputId} className={className} />
    </Suspense>
  );
};
