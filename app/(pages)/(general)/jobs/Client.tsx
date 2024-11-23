"use client";
import FilterSection from "@/app/components/main/FilterSection";
import { Settings2 } from "lucide-react";
import FilterSectionMobile from "@/app/components/main/FilterSectionMobile";
import { useFilter } from "@/provider/FilterProvider";
import JobsContainerForSearch from "@/app/components/main/JobsContainerForSearch";

const Client = () => {
  const { toggleMobileFilter, activeFilterCount, isMobile } = useFilter();

  return (
    <div className="w-full">
      <section className="w-full grid grid-cols-12 relative">
        <section className="col-span-full sm:col-span-8 xl:col-span-9 sm:pr-4 md:px-3 lg:px-0 md:mr-6">
          <div className="mb-5 w-full">
            <div className="w-full flex justify-between items-center">
              <p className="text-xl md:text-2xl font-extralight text-gray-400 mb-2">
                <span className="font-bold text-primary">Job Opportunities</span>
              </p>

              <div className="relative block sm:hidden">
                <Settings2 className="" onClick={toggleMobileFilter} />
                {activeFilterCount > 0 ? (
                  <span className=" absolute -right-2 -top-2.5 px-1 bg-primary font-light text-white rounded-full text-[0.5rem] ml-[6px]">
                    {activeFilterCount}
                  </span>
                ) : null}
              </div>
            </div>
            <hr />
          </div>

          <JobsContainerForSearch />
        </section>
        <FilterSection className="sm:block hidden" isMobile={isMobile} />
      </section>
      <br />

      <FilterSectionMobile className="block sm:hidden" isMobile={isMobile} />
    </div>
  );
};

export default Client;
