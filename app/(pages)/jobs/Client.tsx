"use client";
import FilterSection from "@/app/components/main/FilterSection";
import { useEffect } from "react";
import { Settings2 } from "lucide-react";
import FilterSectionMobile from "@/app/components/main/FilterSectionMobile";
import { FilterProvider, useFilter } from "@/provider/FilterProvider";
import JobsContainer from "@/app/components/main/JobsContainer";

const Client = () => {
  const { toggleMobileFilter, isMobile } = useFilter();

  return (
    <div className="w-full">
      <section className="w-full grid grid-cols-12 relative">
        <section className="col-span-full sm:col-span-8 xl:col-span-9 pr-4 md:px-3 lg:px-0 md:mr-6">
          <div className="mb-5 w-full">
            <div className="w-full flex justify-between items-center">
              <p className="text-xl md:text-2xl font-extralight text-gray-400 mb-2">
                <span className="font-bold text-primary">Job Opportunities</span> <span className="text-base">{`(205)`}</span>
              </p>

              <Settings2 className="block sm:hidden" onClick={toggleMobileFilter} />
            </div>
            <hr />
          </div>

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
