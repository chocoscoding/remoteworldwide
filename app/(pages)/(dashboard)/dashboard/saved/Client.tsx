"use client";

// Saved jobs — every job you've saved, in one list.
//
// These are the same saved jobs the job picker offers on Apply, Ask about a
// job, cover letters, the ATS scorer, referrals and prep: saving one anywhere
// lands it here. This screen saves nothing new of its own — "Add a job" opens
// that same picker — it is the place to see them all and take one straight to
// the tool you need. (The job board's bookmarks and the tracker's "Saved"
// column are separate things and stay where they are.)
//
// Most recently used first, searched on the server by company or role. The
// server caps one read at SAVED_JOBS_SHOWN, so past that the search box is how
// the rest are reached.

import { FC, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText, Mail, Plus, ScanSearch, Search, SearchX, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { useJobPicker } from "@/app/components/dashboard/jobs/JobPickerProvider";
import { atsScoreHref, coverLetterHref, findReferralHref, tailorResumeHref, type JobContextFields } from "@/app/lib/dashboard/contextParams";
import type { JobSource, RemoteType, SavedJobItem } from "@/app/lib/jobs/types";
import { useDeleteSavedJob } from "@/hooks/mutations/useJobMutations";
import { useDebouncedValue, useSavedJobsList } from "@/hooks/queries/useJobQueries";

/** The server's ceiling for one read of saved jobs. */
const SAVED_JOBS_SHOWN = 50;

/** Quiet inline control — weight is reserved for the page's real actions. */
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

const SOURCE_LABELS: Record<JobSource, string> = {
  platform: "Remote Worldwide listing",
  link: "Saved from a link",
  paste: "Pasted",
  manual: "Added by hand",
};

const REMOTE_LABELS: Record<RemoteType, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Used today", "Used 3 days ago", "Used 14 Aug" — a glance, not an audit trail. */
function usedLabel(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const days = Math.floor((Date.now() - at.getTime()) / DAY_MS);
  if (days <= 0) return "Used today";
  if (days === 1) return "Used yesterday";
  if (days < 7) return `Used ${days} days ago`;
  return `Used ${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** The posting itself: our own listing page for a Remote Worldwide job, else the link it was saved from. */
function postingOf(job: SavedJobItem): { href: string; external: boolean } | null {
  if (job.source === "platform" && job.slug) return { href: `/jobs/${encodeURIComponent(job.slug)}`, external: false };
  const link = job.applyUrl ?? job.url;
  return link && /^https?:\/\//i.test(link) ? { href: link, external: true } : null;
}

const askHref = (id: string) => `/dashboard/jdqa?job=${encodeURIComponent(id)}`;

const SavedJobRow: FC<{ job: SavedJobItem }> = ({ job }) => {
  const remove = useDeleteSavedJob();
  const [confirming, setConfirming] = useState(false);

  const title = job.role ?? "Untitled role";
  const company = job.company ?? "Unknown company";
  const context: JobContextFields = { savedJobId: job.id, company: job.company, role: job.role };
  const posting = postingOf(job);

  const where = job.location ?? (job.regions.length > 0 ? job.regions.join(", ") : null);
  const meta = [where, job.remoteType ? REMOTE_LABELS[job.remoteType] : null, job.salary, SOURCE_LABELS[job.source], usedLabel(job.lastUsedAt)]
    .filter(Boolean)
    .join(" · ");

  // "Back to the job" on each tool returns to the job's own screen (Ask about a job).
  const tools = [
    { label: "Tailor resume", href: tailorResumeHref(context, "jdqa"), icon: FileText },
    { label: "Cover letter", href: coverLetterHref(context, "jdqa"), icon: Mail },
    { label: "ATS score", href: atsScoreHref(context, "jdqa"), icon: ScanSearch },
    { label: "Find a referral", href: findReferralHref(context, "jdqa"), icon: Users },
  ];

  return (
    <div className={cn("flex flex-col gap-3 px-6 py-4", remove.isPending && "opacity-55")}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <Link href={askHref(job.id)} className="group/open flex min-w-0 flex-1 items-center gap-4 text-left" title={`Open ${title}`}>
          <Avatar name={company} src={job.companyLogo} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-primary underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover/open:decoration-[#222325]">
              {title}
            </span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-black/65">{company}</span>
            {meta && <span className="mt-0.5 block truncate text-xs text-black/50">{meta}</span>}
          </span>
        </Link>

        <div className="flex flex-none items-center gap-0.5">
          {posting &&
            (posting.external ? (
              <a href={posting.href} target="_blank" rel="noopener noreferrer" className={GHOST_BTN}>
                <ArrowUpRight className="h-3.5 w-3.5" />
                Posting
              </a>
            ) : (
              <Link href={posting.href} className={GHOST_BTN}>
                <ArrowUpRight className="h-3.5 w-3.5" />
                Posting
              </Link>
            ))}
          {confirming ? (
            <>
              <span className="px-1 text-xs text-black/55">Remove it?</span>
              <button
                type="button"
                disabled={remove.isPending}
                className={cn(GHOST_BTN, "text-[#b23c26] hover:bg-[#fdeae6] hover:text-[#b23c26]")}
                onClick={() => remove.mutate(job.id, { onSettled: () => setConfirming(false) })}>
                Remove
              </button>
              <button type="button" className={GHOST_BTN} onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className={cn(GHOST_BTN, "hover:bg-[#fdeae6] hover:text-[#b23c26]")} onClick={() => setConfirming(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>

      {/* The job's tools, each opened with this job already chosen. */}
      <div className="flex flex-wrap items-center gap-1.5 sm:pl-[60px]">
        <Link
          href={askHref(job.id)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#e1f073] px-3 py-1.5 text-xs font-bold text-[#222325] transition-colors hover:bg-[#d4e35f]">
          Ask about it
        </Link>
        {tools.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-[#fbfbf7] px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-[#222325]">
            <Icon className="h-3.5 w-3.5 text-black/55" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
};

/** Flat pulse rows in the list's own layout, while it loads. */
const ListSkeleton: FC = () => (
  <DashCard className="overflow-hidden p-0" aria-busy="true" aria-label="Loading your saved jobs">
    <div className="flex flex-col divide-y divide-black/8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-5">
          <span className="h-11 w-11 flex-none animate-pulse rounded-full bg-black/[0.07]" />
          <div className="min-w-0 flex-1">
            <span className="block h-4 w-44 animate-pulse rounded bg-black/[0.07]" />
            <span className="mt-2 block h-3 w-64 animate-pulse rounded bg-black/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  </DashCard>
);

const SavedJobsClient: FC = () => {
  const { pickJob } = useJobPicker();
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim());
  const jobs = useSavedJobsList(q, SAVED_JOBS_SHOWN);

  const list = jobs.data ?? [];
  const atCap = list.length >= SAVED_JOBS_SHOWN;

  /** The picker saves the job; the list refetches on its own (every save invalidates it). */
  async function addJob() {
    try {
      const result = await pickJob("company, role", { title: "Save a job" });
      if (result.status === "picked") toast.success(`${result.job.role} at ${result.job.company} is saved`);
    } catch {
      toast.error("The job picker hit a problem. Try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="whitespace-nowrap text-[17px] font-bold text-primary">Saved jobs</h1>
          <span className="hidden truncate text-sm text-black/45 sm:inline">Every job you&apos;ve saved, ready for your tools</span>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <StickerButton variant="primary" size="sm" onClick={() => void addJob()}>
            <Plus className="h-3.5 w-3.5" />
            Add a job
          </StickerButton>
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by company or role…"
            aria-label="Search saved jobs"
            className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]"
          />
        </div>

        {jobs.isPending ? (
          <ListSkeleton />
        ) : jobs.isError && list.length === 0 ? (
          <DashCard className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm font-semibold text-primary">We couldn&apos;t load your saved jobs.</p>
            <StickerButton variant="outline" size="sm" onClick={() => void jobs.refetch()}>
              Try again
            </StickerButton>
          </DashCard>
        ) : list.length === 0 ? (
          q ? (
            <DashEmptyState
              icon={SearchX}
              title={`Nothing matches “${q}”`}
              body="Search looks at the company and the role. Try a shorter search, or clear it to see everything."
              ctaLabel="Clear search"
              onCta={() => setQuery("")}
            />
          ) : (
            <DashEmptyState
              icon={Plus}
              title="No saved jobs yet"
              body="Save a Remote Worldwide listing, a link or a pasted posting, and it lands here — ready for your resume, cover letter, ATS score and referrals."
              ctaLabel="Add a job"
              onCta={() => void addJob()}
            />
          )
        ) : (
          <>
            <p className="mb-3 text-xs text-black/55">
              {atCap
                ? `Your ${SAVED_JOBS_SHOWN} most recently used${q ? " matches" : ""} — search to find the rest.`
                : `${list.length} saved job${list.length === 1 ? "" : "s"}${q ? " match" : ""}, most recently used first.`}
            </p>
            <DashCard className="overflow-hidden p-0">
              <div className="flex flex-col divide-y divide-black/8">
                {list.map((job) => (
                  <SavedJobRow key={job.id} job={job} />
                ))}
              </div>
            </DashCard>
          </>
        )}
      </main>
    </div>
  );
};

export default SavedJobsClient;
