import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { checkBookmarkForUser } from "@/libs/query";
import { BOARD_TAGS, backendCachedOrNull } from "@/app/lib/backend";
import type { JobAndCompany } from "@/types/main";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import OneJobClient from "./Client";

// Behind sign-in, so no SEO here: the public /jobs/[id] page owns the metadata and markup.
export const metadata = { title: "Jobs", robots: { index: false, follow: false } };

// The redesigned job page is currently dashboard-only.
export default async function DashboardJobPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = decodeURIComponent((await params).id);
  const job = await backendCachedOrNull<JobAndCompany>(`/jobs/${encodeURIComponent(slug)}`, { revalidate: 43200, tags: [BOARD_TAGS.jobs] });
  if (!job) notFound();

  const session = await auth();
  let hasUserBookmarked: boolean | undefined = undefined;
  if (session?.user?.id && !session.user.deletionDueAt) {
    const bookmark = await checkBookmarkForUser(job.id);
    hasUserBookmarked = Boolean(bookmark.data?.id);
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/jobs"
            className="inline-flex flex-none items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-black/55 transition-colors hover:bg-black/[0.05] hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Jobs
          </Link>
          <p className="truncate text-[17px] font-bold text-primary">{job.title}</p>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <NotificationBell />
        </div>
      </header>

      <OneJobClient Job={job} hasUserBookmarked={hasUserBookmarked} />
    </div>
  );
}
