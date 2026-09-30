"use client";

import type { FC } from "react";
import Link from "next/link";
import { ArrowLeft, Briefcase, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";

export interface JobContextBannerProps {
  /** What this screen is doing for the job, e.g. "Tailoring". */
  action: string;
  role: string | null;
  company: string | null;
  backHref: string | null;
  onDismiss: () => void;
  className?: string;
}

const JobContextBanner: FC<JobContextBannerProps> = ({ action, role, company, backHref, onDismiss, className }) => {
  if (!role && !company) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-[14px] border-2 border-[#222325] bg-white px-4 py-3 text-left", className)}>
      <span aria-hidden className="grid h-7 w-7 flex-none place-content-center rounded-lg bg-[#e1f073]">
        <Briefcase className="h-3.5 w-3.5 text-primary" />
      </span>
      <p className="min-w-0 flex-1 text-sm text-primary">
        {action} for {role ? <span className="font-bold">{role}</span> : "a role"}
        {company && (
          <>
            {" "}
            at <span className="font-bold">{company}</span>
          </>
        )}
      </p>
      {backHref && (
        <Link href={backHref} className={cn(stickerButtonVariants({ variant: "outline", size: "sm" }), "hover:shadow-[3px_3px_0_0_#e1f073]")}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to the job
        </Link>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="h-6 w-6 flex-none rounded-md text-primary/50 flex items-center justify-center transition-colors hover:bg-black/10 hover:text-primary cursor-pointer">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default JobContextBanner;
