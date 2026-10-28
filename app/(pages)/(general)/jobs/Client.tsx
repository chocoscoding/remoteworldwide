"use client";
import SearchBar from "@/app/components/SearchBar";
import FilterBar from "@/app/components/main/FilterBar";
// eslint-disable-next-line unused-imports/no-unused-imports, @typescript-eslint/no-unused-vars -- used by the commented-out ad slots below
import AdSlot from "@/app/components/main/AdSlot";
import JobsContainerForSearch, { type InitialJobs } from "@/app/components/main/JobsContainerForSearch";
import ScrollToTop from "@/app/components/main/ScrollToTop";
import { cn } from "@/lib/utils";

// `showAds` comes from the server (app/lib/ads.ts): true for Free and signed-out visitors, false for Basic and up.
// `initialJobs` is the list the server already queried (page.tsx), so crawlers get real job links.
const Client = ({ showAds, initialJobs }: { showAds: boolean; initialJobs?: InitialJobs }) => {
  return (
    <div className="w-full">
      <SearchBar activeSearch compact />
      <FilterBar className="mt-4 mb-10" compact />

      {/* With ads they flank the list: none on mobile, slim on tablet, wider from lg up, where the
          list takes 3/5 of the row (the old sidebar layout gave it 3/4). Without ads the list is full width. */}
      <section
        className={cn(
          "w-full grid grid-cols-1 gap-4 lg:gap-6",
          showAds && "md:grid-cols-[minmax(0,1fr)_minmax(0,6fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)]",
        )}>
        {/* Ads are built and switched off until launch: uncomment to show the admin's jobs-left ad (/heroshima/ads). */}
        {/* {showAds ? <AdSlot slot="jobs-left" sticky className="hidden md:block" /> : null} */}
        {/* Pinned to the middle column so an ad can never pull the list into its slot. */}
        <section className={cn("min-w-0", showAds && "md:col-span-6")}>
          {/* <div className="mb-5 w-full">
            <p className="text-xl md:text-2xl font-bold text-primary mb-2">Jobs</p>
            <hr />
          </div> */}

          <JobsContainerForSearch initial={initialJobs} />
        </section>
        {/* {showAds ? <AdSlot slot="jobs-right" sticky className="hidden md:block" /> : null} */}
      </section>
      <br />
      <ScrollToTop />
    </div>
  );
};

export default Client;
