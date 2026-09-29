"use client";
import SearchBar from "@/app/components/SearchBar";
import FilterBar from "@/app/components/main/FilterBar";
import AdSlot from "@/app/components/main/AdSlot";
import JobsContainerForSearch from "@/app/components/main/JobsContainerForSearch";
import ScrollToTop from "@/app/components/main/ScrollToTop";
import { cn } from "@/lib/utils";

// `showAds` comes from the server (app/lib/ads.ts): true for Free and signed-out visitors, false for Pro and Ultra.
const Client = ({ showAds }: { showAds: boolean }) => {
  return (
    <div className="w-full">
      <SearchBar activeSearch />
      <FilterBar className="mt-4 mb-10" />

      {/* With ads they flank the list: none on mobile, slim on tablet, wider from lg up, where the
          list takes 3/5 of the row (the old sidebar layout gave it 3/4). Without ads the list is full width. */}
      <section
        className={cn(
          "w-full grid grid-cols-1 gap-4 lg:gap-6",
          showAds && "md:grid-cols-[minmax(0,1fr)_minmax(0,6fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)]",
        )}>
        {showAds ? <AdSlot slot="jobs-left" className="hidden md:block !hidden" /> : null}
        {/* Pinned to the middle column so an ad can never pull the list into its slot. */}
        <section className={cn("min-w-0", showAds && "md:col-span-6")}>
          {/* <div className="mb-5 w-full">
            <p className="text-xl md:text-2xl font-bold text-primary mb-2">Jobs</p>
            <hr />
          </div> */}

          <JobsContainerForSearch />
        </section>
        {showAds ? <AdSlot slot="jobs-right" className="hidden md:block !hidden" /> : null}
      </section>
      <br />
      <ScrollToTop />
    </div>
  );
};

export default Client;
