"use client";
import SearchBar from "@/app/components/SearchBar";
import FilterBar from "@/app/components/main/FilterBar";
import AdSlot from "@/app/components/main/AdSlot";
import JobsContainerForSearch, { type InitialJobs } from "@/app/components/main/JobsContainerForSearch";
import ScrollToTop from "@/app/components/main/ScrollToTop";

// `showAds` comes from the server (app/lib/ads.ts): true for Free and signed-out visitors, false for Basic and up.
// `initialJobs` is the list the server already queried (page.tsx), so crawlers get real job links.
const Client = ({ showAds, initialJobs }: { showAds: boolean; initialJobs?: InitialJobs }) => {
  return (
    <div className="w-full">
      <SearchBar activeSearch compact />
      <FilterBar className="mt-4 mb-10" compact />

      {/* With ads they flank the list: none on mobile, slim on tablet, wider from lg up, where the
          list takes 3/5 of the row (the old sidebar layout gave it 3/4). The side columns open only
          when an ad box actually renders (`has-[>aside]`): a slot with nothing to show renders
          nothing, and then the list is full width, the same as for a paying viewer. */}
      <section className="group/ads w-full grid grid-cols-1 gap-4 lg:gap-6 md:has-[>aside]:grid-cols-[minmax(0,1fr)_minmax(0,6fr)_minmax(0,1fr)] lg:has-[>aside]:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)]">
        {showAds ? <AdSlot slot="jobs-left" shape="tall" className="hidden md:block md:col-start-1 md:row-start-1" /> : null}
        {/* Pinned to the middle column so an ad can never pull the list into its slot. */}
        <section className="min-w-0 md:group-has-[>aside]/ads:col-start-2 md:group-has-[>aside]/ads:row-start-1">
          {/* <div className="mb-5 w-full">
            <p className="text-xl md:text-2xl font-bold text-primary mb-2">Jobs</p>
            <hr />
          </div> */}

          <JobsContainerForSearch initial={initialJobs} />
        </section>
        {showAds ? <AdSlot slot="jobs-right" shape="tall" className="hidden md:block md:col-start-3 md:row-start-1" /> : null}
      </section>
      {showAds ? <AdSlot slot="jobs-bottom" shape="banner" className="mt-8" /> : null}
      <br />
      <ScrollToTop />
    </div>
  );
};

export default Client;
