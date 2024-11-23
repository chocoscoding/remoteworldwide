"use client";
import { FC } from "react";
import FilterCategory from "./FilterCategory";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";
import { useFilter } from "@/provider/FilterProvider";
import FilterSkeleton from "../skeleton/FilterSkeleton";

const FilterSection: FC<{ className?: string; isMobile?: boolean }> = ({ className, isMobile }) => {
  const {
    rolesOptions,
    seniorityOptions,
    jobTypeOptions,
    showSection,
    selectedRoles,
    selectedSeniority,
    selectedJobTypes,
    selectedRegions,
    setSelectedRegions,
    setSelectedRoles,
    setSelectedSeniority,
    setSelectedJobTypes,
    handleSelectOption,
    toggleShowType,
    regionOptions,
  } = useFilter();

  // if (isMobile === true) return null;
  return (
    <section
      className={cn(
        "border border-primary/10 col-span-4 xl:col-span-3 w-full sm:max-w-[300px] max-h-[700px] overflow-y-auto sm:rounded-xl fixed sm:sticky sm:bg-transparent bg-white left-0 top-[65px] h-screen p-3",
        className
      )}>
      <div className="sm:hidden flex items-center justify-center">
        <button
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center focus:outline-none focus:ring-2 focus
            :ring-red-700 p-2"
          onClick={() => console.log("Close icon clicked")}>
          <X className="text-primary" />
        </button>
      </div>
      <header className="flex justify-between">
        <h1 className="font-bold text-xl flex items-center">Filters</h1>
        <button className="text-gray-500 text-sm">Clear</button>
      </header>
      <br />
      <FilterCategory
        title="Roles"
        isOpen={showSection.roles}
        toggle={() => toggleShowType("roles")}
        options={rolesOptions}
        selectedOptions={selectedRoles}
        handleSelectOption={(option) => handleSelectOption(setSelectedRoles, option)}
      />
      <hr />
      {/* Seniority Filter */}
      <FilterCategory
        title="Seniority level"
        isOpen={showSection.seniority}
        toggle={() => toggleShowType("seniority")}
        options={seniorityOptions}
        selectedOptions={selectedSeniority}
        handleSelectOption={(option) => handleSelectOption(setSelectedSeniority, option)}
      />
      <hr />
      {/* Job Type Filter */}
      <FilterCategory
        title="Job Type"
        isOpen={showSection.jobType}
        toggle={() => toggleShowType("jobType")}
        options={jobTypeOptions}
        selectedOptions={selectedJobTypes}
        handleSelectOption={(option) => handleSelectOption(setSelectedJobTypes, option)}
      />
      <hr />
      {/* Region Filter */}
      <FilterCategory
        title="Region"
        isOpen={showSection.region}
        toggle={() => toggleShowType("region")}
        options={regionOptions}
        selectedOptions={selectedRegions}
        handleSelectOption={(option) => handleSelectOption(setSelectedRegions, option)}
      />
    </section>
  );
};

export default FilterSection;
