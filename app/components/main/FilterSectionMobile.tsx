"use client";
import React, { useState, useMemo, Dispatch, SetStateAction, FC, useEffect } from "react";
import FilterCategory from "./FilterCategory";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";
import { useFilter } from "@/provider/FilterProvider";
import FilterSkeleton from "../skeleton/FilterSkeleton";

const FilterSectionMobile: FC<{ className?: string; isMobile?: boolean }> = ({ className, isMobile }) => {
  const {
    rolesOptions,
    seniorityOptions,
    jobTypeOptions,
    showRoles,
    showSeniority,
    showJobType,
    showOnMobile,
    selectedRoles,
    selectedSeniority,
    selectedJobTypes,
    setSelectedRoles,
    setSelectedSeniority,
    setSelectedJobTypes,
    handleSelectOption,
    toggleShowType,
    processState,
    toggleMobileFilter,
  } = useFilter();

  if (typeof isMobile === "undefined") return null;
  if (isMobile === true && showOnMobile === false) return null;
  if (processState === "loading") return <FilterSkeleton className="block sm:hidden" isMobile={isMobile} />;

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
          onClick={toggleMobileFilter}>
          <X className="text-primary" />
        </button>
      </div>
      {processState === "error" ? (
        <>
          <div className="h-[90%] flex flex-col items-center justify-center">
            <p className="text-gray-500 text-lg">Something went wrong, please reload.</p>
            <button className="mt-4 px-4 py-2 bg-primary text-white rounded" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </>
      ) : null}
      {processState === "idle" ? (
        <>
          <header className="flex justify-between">
            <h1 className="font-bold text-xl">Filters</h1>
            <button className="text-gray-500 text-sm">Clear</button>
          </header>
          <br />
          <FilterCategory
            title="Roles"
            isOpen={showRoles}
            toggle={() => toggleShowType("roles")}
            options={rolesOptions}
            selectedOptions={selectedRoles}
            handleSelectOption={(option) => handleSelectOption(setSelectedRoles, option)}
          />
          <hr />
          {/* Seniority Filter */}
          <FilterCategory
            title="Seniority level"
            isOpen={showSeniority}
            toggle={() => toggleShowType("seniority")}
            options={seniorityOptions}
            selectedOptions={selectedSeniority}
            handleSelectOption={(option) => handleSelectOption(setSelectedSeniority, option)}
          />
          <hr />
          {/* Job Type Filter */}
          <FilterCategory
            title="Job Type"
            isOpen={showJobType}
            toggle={() => toggleShowType("jobType")}
            options={jobTypeOptions}
            selectedOptions={selectedJobTypes}
            handleSelectOption={(option) => handleSelectOption(setSelectedJobTypes, option)}
          />
        </>
      ) : null}
    </section>
  );
};

export default FilterSectionMobile;
