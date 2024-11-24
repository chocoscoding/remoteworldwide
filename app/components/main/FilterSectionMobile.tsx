"use client";
import React, { FC } from "react";
import FilterCategory from "./FilterCategory";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";
import { useFilter } from "@/provider/FilterProvider";

const FilterSectionMobile: FC<{ className?: string; isMobile?: boolean }> = ({ className, isMobile }) => {
  const {
    rolesOptions,
    seniorityOptions,
    jobTypeOptions,
    showSection,
    showOnMobile,
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
    toggleMobileFilter,
    regionOptions,
  } = useFilter();

  if (showOnMobile === false) return null;

  return (
    <section
      className={cn(
        "border border-primary/10 col-span-4 xl:col-span-3 w-full sm:max-w-[300px] overflow-y-auto sm:rounded-xl fixed z-50 sm:sticky sm:bg-transparent bg-white left-0 top-[65px] h-[calc(100vh-64px)] p-3",
        className
      )}>
      <div className="sm:hidden flex items-center justify-center">
        <button
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center focus:outline-none focus:ring-2 focus
            :ring-red-700 p-2"
          onClick={toggleMobileFilter}>
          <X className="text-primary" />
        </button>
      </div>

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

export default FilterSectionMobile;
