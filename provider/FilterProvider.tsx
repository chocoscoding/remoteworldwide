"use client";
import { FilterData, FilterType } from "@/types/main";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useState,
} from "react";
import { DateRange } from "react-day-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  normalizeDateRange,
  formatDateParam,
  parseDateParam,
  isDefaultRange,
} from "@/lib/dateFilterUtils";

const ShowType = {
  roles: false,
  seniority: false,
  region: false,
  dateRange: false,
};
export const DETAIL_FILTER_KEYS = [
  "roleCategory",
  "countries",
  "employmentType",
  "visaSponsorship",
  "visaType",
  "salaryMin",
  "salaryCurrency",
  "salaryPeriod",
  "worldwide",
  "status",
] as const;
export type DetailFilterKey = (typeof DETAIL_FILTER_KEYS)[number];
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
  handleSelectOption: (
    setter: Dispatch<SetStateAction<string[]>>,
    option: string,
  ) => void;
  toggleShowType: (type: keyof typeof ShowType) => void;
  toggleMobileFilter: () => void;
  clearFilters: () => void;
  detailFilters: Record<DetailFilterKey, string>;
  setDetailFilter: (key: DetailFilterKey, value: string) => void;
  setDetailFilters: (values: Partial<Record<DetailFilterKey, string>>) => void;
}
const FilterContext = createContext<FilterContextType | undefined>(undefined);
export function FilterProvider({
  filterData,
  children,
}: {
  filterData: FilterData;
  children: ReactNode;
}) {
  const params = useSearchParams(),
    pathname = usePathname(),
    router = useRouter();
  const [showSection, setShowSection] = useState(ShowType),
    [showOnMobile, setShowOnMobile] = useState(false);
  // The URL is the source of truth, including back/forward navigation and shared links.
  const selectedRoles = params.get("roles")?.split("_").filter(Boolean) ?? [];
  const selectedRegions =
    params.get("regions")?.split("_").filter(Boolean) ?? [];
  const selectedSeniority =
    params.get("seniority")?.split("_").filter(Boolean) ?? [];
  const from = parseDateParam(params.get("dateFrom")),
    to = parseDateParam(params.get("dateTo"));
  const dateRange = from
    ? normalizeDateRange({ from, to: to ?? undefined })
    : undefined;
  const detailFilters = Object.fromEntries(
    DETAIL_FILTER_KEYS.map((key) => [key, params.get(key) ?? ""]),
  ) as Record<DetailFilterKey, string>;
  const change = (values: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(next.size ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  };
  const setter =
    (key: string, current: string[]): Dispatch<SetStateAction<string[]>> =>
    (value) =>
      change({
        [key]: (typeof value === "function" ? value(current) : value).join("_"),
      });
  const setDateRange: Dispatch<SetStateAction<DateRange | undefined>> = (
    value,
  ) => {
    const next = normalizeDateRange(
      typeof value === "function" ? value(dateRange) : value,
    );
    const include = !isDefaultRange(next);
    change({
      dateFrom: include && next?.from ? formatDateParam(next.from) : "",
      dateTo: include && next?.to ? formatDateParam(next.to) : "",
    });
  };
  const clearFilters = () =>
    change(
      Object.fromEntries(
        [
          "roles",
          "regions",
          "seniority",
          "dateFrom",
          "dateTo",
          ...DETAIL_FILTER_KEYS,
        ].map((key) => [key, ""]),
      ),
    );
  return (
    <FilterContext.Provider
      value={{
        rolesOptions: filterData.category,
        seniorityOptions: filterData.seniority,
        regionOptions: filterData.region,
        showSection,
        showOnMobile,
        selectedRoles,
        selectedRegions,
        selectedSeniority,
        dateRange,
        activeFilterCount:
          selectedRoles.length +
          selectedRegions.length +
          selectedSeniority.length +
          DETAIL_FILTER_KEYS.filter((key) => detailFilters[key]).length,
        setSelectedRoles: setter("roles", selectedRoles),
        setSelectedRegions: setter("regions", selectedRegions),
        setSelectedSeniority: setter("seniority", selectedSeniority),
        setDateRange,
        handleSelectOption: (set, option) =>
          set((prev) =>
            prev.includes(option)
              ? prev.filter((v) => v !== option)
              : [...prev, option],
          ),
        toggleShowType: (type) =>
          setShowSection((prev) => ({ ...prev, [type]: !prev[type] })),
        toggleMobileFilter: () => setShowOnMobile((prev) => !prev),
        clearFilters,
        detailFilters,
        setDetailFilter: (key, value) => change({ [key]: value }),
        setDetailFilters: (values) => change(values as Record<string, string>),
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}
export function useFilter() {
  const context = useContext(FilterContext);
  if (!context)
    throw new Error("useFilter must be used within a FilterProvider");
  return context;
}
