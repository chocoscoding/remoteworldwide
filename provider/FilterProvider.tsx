"use client";

import { FilterData, FilterType } from "@/types/main";
import { createContext, Dispatch, ReactNode, SetStateAction, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
const ShowType = { roles: false, seniority: false, jobType: false, region: false };
interface FilterContextType {
  rolesOptions: FilterType[];
  seniorityOptions: FilterType[];
  jobTypeOptions: FilterType[];
  regionOptions: FilterType[];
  showSection: typeof ShowType;
  isMobile?: boolean;
  showOnMobile: boolean;
  selectedRoles: string[];
  selectedSeniority: string[];
  selectedJobTypes: string[];
  selectedRegions: string[];
  activeFilterCount: number;
  setSelectedRegions: Dispatch<SetStateAction<string[]>>;
  setSelectedRoles: Dispatch<SetStateAction<string[]>>;
  setSelectedSeniority: Dispatch<SetStateAction<string[]>>;
  setSelectedJobTypes: Dispatch<SetStateAction<string[]>>;
  handleSelectOption: (setSelectedOption: Dispatch<SetStateAction<string[]>>, option: string) => void;
  toggleShowType: (type: keyof typeof ShowType) => void;
  toggleMobileFilter: () => void;
}
const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ filterData, children }: { filterData: FilterData; children: ReactNode }) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const rolesOptions = filterData.category;
  const seniorityOptions = filterData.seniority;
  const jobTypeOptions = filterData.job_type;
  const regionOptions = filterData.region;

  const [showSection, setShowSection] = useState<typeof ShowType>(ShowType);
  const [showOnMobile, setShowOnMobile] = useState(false);
  // State to track selected options
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedSeniority, setSelectedSeniority] = useState<string[]>([]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const activeFilterCount = useMemo(() => {
    return selectedRoles.length + selectedRegions.length + selectedSeniority.length + selectedJobTypes.length;
  }, [selectedRoles, selectedRegions, selectedSeniority, selectedJobTypes]);
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  // Function to handle selecting and disselecting an option
  const handleSelectOption = (setSelectedOption: Dispatch<SetStateAction<string[]>>, option: string) => {
    setSelectedOption((prev) => (prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]));
  };

  //handle route update
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    params.delete("roles");
    params.delete("regions");
    params.delete("seniority");
    params.delete("jobTypes");

    if (selectedRoles.length > 0) {
      params.append("roles", selectedRoles.join("_"));
    }
    if (selectedRegions.length > 0) {
      params.append("regions", selectedRegions.join("_"));
    }
    if (selectedSeniority.length > 0) {
      params.append("seniority", selectedSeniority.join("_"));
    }
    if (selectedJobTypes.length > 0) {
      params.append("jobTypes", selectedJobTypes.join("_"));
    }

    router.push(pathname + "?" + params.toString());
    router.refresh();
  }, [selectedRoles, selectedRegions, selectedSeniority, selectedJobTypes]);

  //to toggle the showing each filter category
  const toggleShowType = (type: keyof typeof ShowType) => {
    setShowSection((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const toggleMobileFilter = () => {
    setShowOnMobile((prev) => !prev);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 640) {
        setIsMobile(false);
      } else {
        console.log(window.innerWidth);
        setIsMobile(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  //useeffct to close the filter on mobile when the screen is resized
  useEffect(() => {
    if (window.innerWidth > 640) return;

    const handleResize = () => {
      setShowOnMobile(true);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const finalValues = {
    rolesOptions,
    seniorityOptions,
    jobTypeOptions,
    showOnMobile,
    selectedRoles,
    selectedSeniority,
    selectedJobTypes,
    selectedRegions,
    setSelectedRoles,
    setSelectedRegions,
    setSelectedSeniority,
    setSelectedJobTypes,
    handleSelectOption,
    toggleShowType,
    toggleMobileFilter,
    activeFilterCount,
    isMobile,
    regionOptions,
    showSection,
  };
  return <FilterContext.Provider value={finalValues}>{children}</FilterContext.Provider>;
};

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
};
