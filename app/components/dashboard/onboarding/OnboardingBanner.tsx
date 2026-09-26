"use client";

// "Finish your profile" — the dashboard's only nod to onboarding, and never a
// wall: every screen stays usable, and the X puts it away until the next full
// load. Nothing is locked anywhere (owner, 2026-09-26); the profile is what
// the extension fills forms and builds resumes from, so this says what's left
// and links straight to the first open field (`/onboarding#<id>`).
//
// Reads the settings the layout already fetched (same cache key as
// SettingsProvider, so no extra request), and hides when `onboarding` is
// absent — an older backend or a cache from before it — rather than nagging on
// a guess. The count is the server's list (x/7), never a number kept here.

import { useState, type FC } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { ONBOARDING_PATH } from "@/app/lib/next-url";
import { useProfileSettings } from "@/hooks/queries/useSettingsQuery";

/**
 * Screens that are exactly one viewport tall (`h-screen overflow-hidden`: the coach's chat, the
 * tracker's board). A bar above them would push their bottom edge — the composer, the columns'
 * ends — below the fold, so it stays off there; every other screen carries it.
 */
const FULL_HEIGHT_SCREENS = ["/dashboard/coach", "/dashboard/tracker"];

const OnboardingBanner: FC = () => {
  const pathname = usePathname();
  const onboarding = useProfileSettings().data?.onboarding;
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !onboarding || onboarding.ready) return null;
  if (FULL_HEIGHT_SCREENS.some((screen) => pathname === screen || pathname?.startsWith(`${screen}/`))) return null;

  const done = onboarding.items.filter((item) => item.done).length;
  const left = onboarding.items.filter((item) => !item.done);
  // Back to this screen afterwards ("Skip for now" and "Continue" both honour it), opened at the
  // first open field. `left` is never empty here: `ready` is exactly "nothing left".
  const href = `${ONBOARDING_PATH}?next=${encodeURIComponent(pathname || "/dashboard")}${left[0] ? `#${left[0].id}` : ""}`;

  return (
    <div className="flex items-center gap-3 border-b border-primary/15 bg-secondary/70 px-4 py-2.5 md:px-8" role="status">
      <span className="hidden flex-none rounded-full border border-primary/25 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums sm:inline">
        {done}/{onboarding.items.length}
      </span>
      <p className="min-w-0 flex-1 text-sm text-primary">
        <span className="font-semibold">Finish your profile</span>
        <span className="hidden text-primary/70 md:inline">
          {" "}
          — the extension fills applications and builds resumes from it. {left.length === 1 ? `One thing left: ${left[0].label}.` : `${left.length} things left.`}
        </span>
      </p>
      <Link
        href={href}
        className="inline-flex flex-none items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-[transform,box-shadow] duration-100 hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_0_#ffffff]">
        Finish
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
      <button
        type="button"
        aria-label="Hide for now"
        onClick={() => setDismissed(true)}
        className="grid h-7 w-7 flex-none place-content-center rounded-md text-primary/50 transition-colors hover:bg-black/10 hover:text-primary cursor-pointer">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default OnboardingBanner;
