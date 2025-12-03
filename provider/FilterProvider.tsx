"use client";

import { FilterData, FilterType } from "@/types/main";
import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
const ShowType = { roles: false, seniority: false, region: false };
interface FilterContextType {
  rolesOptions: FilterType[];
  seniorityOptions: FilterType[];
  regionOptions: FilterType[];
  showSection: typeof ShowType;
  showOnMobile: boolean;
  selectedRoles: string[];
  selectedSeniority: string[];
  selectedRegions: string[];
  activeFilterCount: number;
  setSelectedRegions: Dispatch<SetStateAction<string[]>>;
  setSelectedRoles: Dispatch<SetStateAction<string[]>>;
  setSelectedSeniority: Dispatch<SetStateAction<string[]>>;
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
  const regionOptions = filterData.region;

  const [showSection, setShowSection] = useState<typeof ShowType>(ShowType);
  const [showOnMobile, setShowOnMobile] = useState(false);
  // State to track selected options
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedSeniority, setSelectedSeniority] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false); // Flag to track initial load
  const activeFilterCount = useMemo(() => {
    return selectedRoles.length + selectedRegions.length + selectedSeniority.length;
  }, [selectedRoles, selectedRegions, selectedSeniority]);
  // Function to handle selecting and disselecting an option
  const handleSelectOption = (setSelectedOption: Dispatch<SetStateAction<string[]>>, option: string) => {
    setSelectedOption((prev) => (prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]));
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (!isInitialized) {
      // Parse URL parameters on initial load
      const roles = params.get("roles")?.split("_") || [];
      const regions = params.get("regions")?.split("_") || [];
      const seniority = params.get("seniority")?.split("_") || [];

      setSelectedRoles(roles);
      setSelectedRegions(regions);
      setSelectedSeniority(seniority);

      setIsInitialized(true); // Mark initialization as complete
    } else {
      // Update URL when states change
      params.delete("roles");
      params.delete("regions");
      params.delete("seniority");

      if (selectedRoles.length > 0) {
        params.append("roles", selectedRoles.join("_"));
        params.delete("page");
        params.append("page", `1`);
      }
      if (selectedRegions.length > 0) {
        params.append("regions", selectedRegions.join("_"));
        params.delete("page");
        params.append("page", `1`);
      }
      if (selectedSeniority.length > 0) {
        params.append("seniority", selectedSeniority.join("_"));
        params.delete("page");
        params.append("page", `1`);
      }

      router.push(pathname + "?" + params.toString());
    }
  }, [searchParams, selectedRoles, selectedRegions, selectedSeniority, isInitialized]);

  //to toggle the showing each filter category
  const toggleShowType = (type: keyof typeof ShowType) => {
    setShowSection((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const toggleMobileFilter = () => {
    setShowOnMobile((prev) => !prev);
  };

  const finalValues = {
    rolesOptions,
    seniorityOptions,
    showOnMobile,
    selectedRoles,
    selectedSeniority,
    selectedRegions,
    setSelectedRoles,
    setSelectedRegions,
    setSelectedSeniority,
    handleSelectOption,
    toggleShowType,
    toggleMobileFilter,
    activeFilterCount,
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
