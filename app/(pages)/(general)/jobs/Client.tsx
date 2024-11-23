"use client";
import FilterSection from "@/app/components/main/FilterSection";
import { useFilter } from "@/provider/FilterProvider";
import FilterSectionMobile from "@/app/components/main/FilterSectionMobile";
import JobsContainer from "@/app/components/main/JobsContainer";

const Client = () => {
  const { isMobile } = useFilter();

  return (
    <div className="w-full">
      <section className="w-full grid grid-cols-12 relative">
        <section className="col-span-full sm:col-span-8 xl:col-span-9 sm:pr-4 md:px-3 lg:px-0 md:mr-6">
          <JobsContainer />
        </section>
        <FilterSection className="sm:block hidden" isMobile={isMobile} />
      </section>
      <br />

      <FilterSectionMobile className="block sm:hidden" isMobile={isMobile} />
    </div>
  );
};

export default Client;
