"use client";

import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect, useMemo, useState } from "react";

type FilterOptions = Array<{ label: string; count?: number }>;

interface FilterContextType {
  rolesOptions: FilterOptions;
  seniorityOptions: FilterOptions;
  jobTypeOptions: FilterOptions;
  showRoles: boolean;
  showSeniority: boolean;
  showJobType: boolean;
  isMobile?: boolean;
  showOnMobile: boolean;
  selectedRoles: string[];
  selectedSeniority: string[];
  selectedJobTypes: string[];
  setSelectedRoles: Dispatch<SetStateAction<string[]>>;
  setSelectedSeniority: Dispatch<SetStateAction<string[]>>;
  setSelectedJobTypes: Dispatch<SetStateAction<string[]>>;
  handleSelectOption: (setSelectedOption: Dispatch<SetStateAction<string[]>>, option: string) => void;
  toggleShowType: (type: "roles" | "seniority" | "jobType") => void;
  processState: "idle" | "error" | "loading";
  toggleMobileFilter: () => void;
}
const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  // Memoized options for better performance
  const rolesOptions = useMemo(() => Array(30).fill({ label: "Business development developers", count: 202 }), []);
  const seniorityOptions = useMemo(() => ["Junior", "Mid-level", "Senior", "Expert & Leadership"].map((label) => ({ label })), []);
  const jobTypeOptions = useMemo(() => ["Full-time", "Part-time", "Freelance/Contract", "Internship"].map((label) => ({ label })), []);

  const [processState, setProcessState] = useState<"loading" | "idle" | "error">("loading");
  const [showRoles, setShowRoles] = useState(false);
  const [showSeniority, setShowSeniority] = useState(false);
  const [showJobType, setShowJobType] = useState(false);

  const [showOnMobile, setShowOnMobile] = useState(false);
  // State to track selected options
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedSeniority, setSelectedSeniority] = useState<string[]>([]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);

  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  // Function to handle selecting and disselecting an option
  const handleSelectOption = (setSelectedOption: Dispatch<SetStateAction<string[]>>, option: string) => {
    setSelectedOption((prev) => (prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]));
  };

  //to toggle the showing each filter category
  const setShowingType = {
    roles: setShowRoles,
    seniority: setShowSeniority,
    jobType: setShowJobType,
  };
  const toggleShowType = (type: keyof typeof setShowingType) => {
    setShowingType[type]((prev) => !prev);
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

  const fetchData = new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({ data: "1234" });
    }, 3000);
  });

  useEffect(() => {
    const getAllFilters = async () => {
      await fetchData;
      setProcessState("idle");
    };
    getAllFilters();
  }, []);

  const finalValues = {
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
    isMobile,
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
