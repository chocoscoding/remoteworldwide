import type { FC, ReactNode } from "react";
import Link from "next/link";
import LogoFull from "@/app/components/svg/LogoFull";

/** The onboarding pages' only chrome: the logo home, who is signed in, and one way out. */
const OnboardingHeader: FC<{ email?: string | null; action?: ReactNode }> = ({ email, action }) => (
  <header className="border-b border-primary/10 bg-white/85 backdrop-blur-sm">
    <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-4 px-4 md:px-8">
      <Link href="/" aria-label="Remote Worldwide home" className="flex-none">
        <LogoFull className="h-[18px] w-auto" />
      </Link>
      <div className="flex min-w-0 items-center gap-4">
        {email && (
          <span className="hidden min-w-0 truncate text-xs text-primary/50 sm:inline">
            Signed in as <span className="font-semibold text-primary/70">{email}</span>
          </span>
        )}
        {action}
      </div>
    </div>
  </header>
);

export default OnboardingHeader;
