"use client";

import { FilterData, FilterType } from "@/types/main";
import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DateRange } from "react-day-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDefaultRange, normalizeDateRange, formatDateParam, parseDateParam, isDefaultRange } from "@/lib/dateFilterUtils";

const ShowType = { roles: false, seniority: false, region: false, dateRange: false };

interface SelectedFilters {
  roles: string[];
  regions: string[];
  seniority: string[];
}

interface FilterContextType {
  rolesOptions: FilterType[];
  seniorityOptions: FilterType[];
  regionOptions: FilterType[];
  showSection: typeof ShowType;
  showOnMobile: boolean;
  selectedRoles: string[];
  selectedSeniority: string[];
  selectedRegions: string[];
  dateRange: DateRange | undefined;
  activeFilterCount: number;
  setSelectedRegions: Dispatch<SetStateAction<string[]>>;
  setSelectedRoles: Dispatch<SetStateAction<string[]>>;
  setSelectedSeniority: Dispatch<SetStateAction<string[]>>;
  setDateRange: Dispatch<SetStateAction<DateRange | undefined>>;
  handleSelectOption: (setSelectedOption: Dispatch<SetStateAction<string[]>>, option: string) => void;
  toggleShowType: (type: keyof typeof ShowType) => void;
  toggleMobileFilter: () => void;
  clearFilters: () => void;
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
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    roles: [],
    regions: [],
    seniority: [],
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => getDefaultRange());
  const [isInitialized, setIsInitialized] = useState(false);

  // Individual setters that update combined state
  const setSelectedRoles = (roles: string[]) => setSelectedFilters((prev) => ({ ...prev, roles }));
  const setSelectedRegions = (regions: string[]) => setSelectedFilters((prev) => ({ ...prev, regions }));
  const setSelectedSeniority = (seniority: string[]) => setSelectedFilters((prev) => ({ ...prev, seniority }));

  const activeFilterCount = useMemo(() => {
    return selectedFilters.roles.length + selectedFilters.regions.length + selectedFilters.seniority.length;
  }, [selectedFilters]);
  // Function to handle selecting and disselecting an option
  const handleSelectOption = (setSelectedOption: Dispatch<SetStateAction<string[]>>, option: string) => {
    setSelectedOption((prev) => (prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]));
  };

  const prevFiltersRef = useRef({
    roles: selectedFilters.roles,
    regions: selectedFilters.regions,
    seniority: selectedFilters.seniority,
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (!isInitialized) {
      const roles = params.get("roles")?.split("_") || [];
      const regions = params.get("regions")?.split("_") || [];
      const seniority = params.get("seniority")?.split("_") || [];
      const dateFromParam = params.get("dateFrom");
      const dateToParam = params.get("dateTo");
      const parsedFrom = parseDateParam(dateFromParam);
      const parsedTo = parseDateParam(dateToParam);
      const defaultRange = getDefaultRange();
      const initialRange = normalizeDateRange({
        from: parsedFrom ?? defaultRange.from,
        to: parsedTo ?? defaultRange.to,
      });

      setSelectedFilters({ roles, regions, seniority });
      setDateRange(initialRange);
      const includeDateParams = !isDefaultRange(initialRange);
      prevFiltersRef.current = {
        roles,
        regions,
        seniority,
        dateFrom: includeDateParams && initialRange?.from ? formatDateParam(initialRange.from) : "",
        dateTo: includeDateParams && initialRange?.to ? formatDateParam(initialRange.to) : "",
      };
      setIsInitialized(true);
    } else {
      const prev = prevFiltersRef.current;
      const normalizedRange = normalizeDateRange(dateRange);
      const includeDateParams = !isDefaultRange(normalizedRange);
      const dateFromValue = includeDateParams && normalizedRange?.from ? formatDateParam(normalizedRange.from) : "";
      const dateToValue = includeDateParams && normalizedRange?.to ? formatDateParam(normalizedRange.to) : "";
      const filtersChanged =
        prev.roles !== selectedFilters.roles ||
        prev.regions !== selectedFilters.regions ||
        prev.seniority !== selectedFilters.seniority ||
        prev.dateFrom !== dateFromValue ||
        prev.dateTo !== dateToValue;

      prevFiltersRef.current = {
        roles: selectedFilters.roles,
        regions: selectedFilters.regions,
        seniority: selectedFilters.seniority,
        dateFrom: dateFromValue,
        dateTo: dateToValue,
      };

      // If only searchParams changed (e.g. pagination updated the URL), do nothing
      if (!filtersChanged) return;

      params.delete("roles");
      params.delete("regions");
      params.delete("seniority");
      params.delete("dateFrom");
      params.delete("dateTo");
      params.delete("page");
      params.append("page", "1");

      if (selectedFilters.roles.length > 0) params.append("roles", selectedFilters.roles.join("_"));
      if (selectedFilters.regions.length > 0) params.append("regions", selectedFilters.regions.join("_"));
      if (selectedFilters.seniority.length > 0) params.append("seniority", selectedFilters.seniority.join("_"));
      if (dateFromValue) params.append("dateFrom", dateFromValue);
      if (dateToValue) params.append("dateTo", dateToValue);

      router.push(pathname + "?" + params.toString());
    }
  }, [searchParams, selectedFilters, dateRange, isInitialized]);

  //to toggle the showing each filter category
  const toggleShowType = (type: keyof typeof ShowType) => {
    setShowSection((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const toggleMobileFilter = () => {
    setShowOnMobile((prev) => !prev);
  };

  const clearFilters = () => {
    setSelectedFilters({ roles: [], regions: [], seniority: [] });
    setDateRange(getDefaultRange());
  };

  const finalValues = {
    rolesOptions,
    seniorityOptions,
    showOnMobile,
    selectedRoles: selectedFilters.roles,
    selectedSeniority: selectedFilters.seniority,
    selectedRegions: selectedFilters.regions,
    dateRange,
    setSelectedRoles,
    setSelectedRegions,
    setSelectedSeniority,
    setDateRange,
    handleSelectOption,
    toggleShowType,
    toggleMobileFilter,
    clearFilters,
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
