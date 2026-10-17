"use client";
import SearchBar from "@/app/components/SearchBar";
import FilterBar from "@/app/components/main/FilterBar";
import JobsContainerForSearch, { type InitialJobs } from "@/app/components/main/JobsContainerForSearch";
import ScrollToTop from "@/app/components/main/ScrollToTop";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";

/** The public board's search, filters and list, in the dashboard's page frame. No ads in here. */
const DashboardJobsClient = ({ initialJobs }: { initialJobs?: InitialJobs }) => {
  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="whitespace-nowrap text-[17px] font-bold text-primary">Jobs</h1>
          <span className="hidden truncate text-sm text-black/45 sm:inline">Remote jobs you can do from anywhere</span>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        <SearchBar activeSearch compact />
        <FilterBar className="mt-4 mb-8" compact />
        <JobsContainerForSearch initial={initialJobs} jobBasePath="/dashboard/jobs" />
        <ScrollToTop />
      </main>
    </div>
  );
};

export default DashboardJobsClient;
