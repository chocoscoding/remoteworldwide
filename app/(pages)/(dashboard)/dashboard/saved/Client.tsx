"use client";

// Saved jobs are the user's job-board bookmarks.

import { FC, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteBookmarkForUser, getAllBookmarksForUser } from "@/libs/query";
import type { OneBookmarkType } from "@/types/main";
import { saveJob } from "@/app/lib/jobs/api";
import { qk } from "@/app/lib/query/keys";
import { ArrowUpRight, FileText, Mail, Plus, ScanSearch, Search, SearchX, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import { JobRowsSkeleton } from "@/app/components/dashboard/ui/Skeleton";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { atsScoreHref, coverLetterHref, findReferralHref, tailorResumeHref, type JobContextFields } from "@/app/lib/dashboard/contextParams";

const BOOKMARKS_KEY = ["bookmarks"] as const;

// Deleted listings can leave short pages. Follow the total rather than page length.
async function listBookmarks() {
  const first = await getAllBookmarksForUser(1);
  const items = [...first.data];
  for (let page = 2; page <= Math.ceil(first.count / 30); page++) {
    const next = await getAllBookmarksForUser(page);
    items.push(...next.data);
  }
  return items;
}

/** Quiet inline control — weight is reserved for the page's real actions. */
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

const askHref = (id: string) => `/dashboard/jdqa?job=${encodeURIComponent(id)}`;

const SavedJobRow: FC<{ job: OneBookmarkType["job"] }> = ({ job }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const remove = useMutation({
    mutationFn: deleteBookmarkForUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOOKMARKS_KEY }),
    onError: () => toast.error("Couldn't remove this saved job. Try again."),
  });
  const openTool = useMutation({
    mutationFn: async (href: (context: JobContextFields) => string) => {
      const saved = await saveJob({ platformJobId: job.id });
      queryClient.setQueryData(qk.savedJobs.detail(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: qk.savedJobs.lists() });
      router.push(href({ savedJobId: saved.id, company: saved.company, role: saved.role }));
    },
    onError: () => toast.error("Couldn't open this job. The listing may no longer be available."),
  });
  const [confirming, setConfirming] = useState(false);
  const title = job.title || "Untitled role";
  const company = job.company.name || "Unknown company";
  const posting = `/jobs/${encodeURIComponent(job.slug)}`;
  const meta = [job.region.join(", "), job.seniority, job.category, "Remote Worldwide listing"].filter(Boolean).join(" · ");
  const openAsk = () => openTool.mutate((context) => askHref(context.savedJobId!));

  // "Back to the job" on each tool returns to the job's own screen (Ask about a job).
  const tools = [
    { label: "Tailor resume", href: (context: JobContextFields) => tailorResumeHref(context, "jdqa"), icon: FileText },
    { label: "Cover letter", href: (context: JobContextFields) => coverLetterHref(context, "jdqa"), icon: Mail },
    { label: "ATS score", href: (context: JobContextFields) => atsScoreHref(context, "jdqa"), icon: ScanSearch },
    { label: "Find a referral", href: (context: JobContextFields) => findReferralHref(context, "jdqa"), icon: Users },
  ];

  return (
    <div className={cn("flex flex-col gap-3 px-6 py-4", remove.isPending && "opacity-55")}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <button type="button" disabled={openTool.isPending} onClick={openAsk} className="group/open flex min-w-0 flex-1 items-center gap-4 text-left" title={`Open ${title}`}>
          <Avatar name={company} src={job.company.logo} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-primary underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover/open:decoration-[#222325]">
              {title}
            </span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-black/65">{company}</span>
            {meta && <span className="mt-0.5 block truncate text-xs text-black/50">{meta}</span>}
          </span>
        </button>

        <div className="flex flex-none items-center gap-0.5">
          <Link href={posting} className={GHOST_BTN}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            Posting
          </Link>
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
        <button
          type="button"
          disabled={openTool.isPending}
          onClick={openAsk}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#e1f073] px-3 py-1.5 text-xs font-bold text-[#222325] transition-colors hover:bg-[#d4e35f]">
          Ask about it
        </button>
        {tools.map(({ label, href, icon: Icon }) => (
          <button
            type="button"
            disabled={openTool.isPending}
            key={label}
            onClick={() => openTool.mutate(href)}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-[#fbfbf7] px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-[#222325]">
            <Icon className="h-3.5 w-3.5 text-black/55" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * The list as it will look, while it loads (owner, 2026-10-04): each row as
 * SavedJobRow lays it out. The widths are the controls as they render: Posting
 * and Remove; Ask about it, then Tailor resume, Cover letter, ATS score and
 * Find a referral.
 */
const ListSkeleton: FC = () => (
  <JobRowsSkeleton
    label="Loading your saved jobs"
    actions={["w-[81px]", "w-[82px]"]}
    chips={["w-[93px]", "w-[124px]", "w-[114px]", "w-[103px]", "w-[125px]"]}
  />
);

const SavedJobsClient: FC = () => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const jobs = useQuery({ queryKey: BOOKMARKS_KEY, queryFn: listBookmarks, staleTime: 0 });
  const list = (jobs.data ?? []).filter(({ job }) =>
    !q || `${job.company.name} ${job.title}`.toLowerCase().includes(q),
  );
  const addJob = () => router.push("/");

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
              body="Bookmark a job on Remote Worldwide and it lands here, ready for your resume, cover letter, ATS score and referrals."
              ctaLabel="Add a job"
              onCta={() => void addJob()}
            />
          )
        ) : (
          <>
            <p className="mb-3 text-xs text-black/55">
              {`${list.length} saved job${list.length === 1 ? "" : "s"}${q ? " match" : ""}, most recently saved first.`}
            </p>
            <DashCard className="overflow-hidden p-0">
              <div className="flex flex-col divide-y divide-black/8">
                {list.map(({ job }) => (
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
