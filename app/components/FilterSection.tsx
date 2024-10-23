"use client";
import React, { useState, useMemo, Dispatch, SetStateAction } from "react";
import FilterCategory from "./FilterCategory";

const FilterSection = () => {
  const [showRoles, setShowRoles] = useState(true);
  const [showSeniority, setShowSeniority] = useState(true);
  const [showJobType, setShowJobType] = useState(true);

  // State to track selected options
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedSeniority, setSelectedSeniority] = useState<string[]>([]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);

  // Function to handle selecting and disselecting an option
  const handleSelectOption = (setSelectedOption: Dispatch<SetStateAction<string[]>>, option: string) => {
    setSelectedOption((prev) => (prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]));
  };

  // Memoized options for better performance
  const rolesOptions = useMemo(() => Array(30).fill({ label: "Business development developers", count: 202 }), []);
  const seniorityOptions = useMemo(() => ["Junior", "Mid-level", "Senior", "Expert & Leadership"].map((label) => ({ label })), []);
  const jobTypeOptions = useMemo(() => ["Full-time", "Part-time", "Freelance/Contract", "Internship"].map((label) => ({ label })), []);

  return (
    <section className="border border-primary/10 w-3/12 max-w-[300px] max-h-[700px] overflow-y-auto rounded-xl sticky top-[20px] h-screen p-3">
      <header className="flex justify-between">
        <h1 className="font-bold text-xl">Filters</h1>
        <button className="text-gray-500 text-sm">Clear</button>
      </header>

      <FilterCategory
        title="Roles"
        isOpen={showRoles}
        toggle={() => setShowRoles((prev) => !prev)}
        options={rolesOptions}
        selectedOptions={selectedRoles}
        handleSelectOption={(option) => handleSelectOption(setSelectedRoles, option)}
      />
      <br />
      <hr />

      {/* Seniority Filter */}
      <FilterCategory
        title="Seniority level"
        isOpen={showSeniority}
        toggle={() => setShowSeniority((prev) => !prev)}
        options={seniorityOptions}
        selectedOptions={selectedSeniority}
        handleSelectOption={(option) => handleSelectOption(setSelectedSeniority, option)}
      />
      <br />
      <hr />

      {/* Job Type Filter */}
      <FilterCategory
        title="Job Type"
        isOpen={showJobType}
        toggle={() => setShowJobType((prev) => !prev)}
        options={jobTypeOptions}
        selectedOptions={selectedJobTypes}
        handleSelectOption={(option) => handleSelectOption(setSelectedJobTypes, option)}
      />
    </section>
  );
};

export default FilterSection;
