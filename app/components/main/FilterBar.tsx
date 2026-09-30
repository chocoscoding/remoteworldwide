"use client";
import { FC, ReactNode, useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import { CalendarIcon, Check, ChevronDown, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFilter } from "@/provider/FilterProvider";
import { isDefaultRange, normalizeDateRange } from "@/lib/dateFilterUtils";
import { FilterType } from "@/types/main";
import { cn } from "@/lib/utils";

// Horizontal replacement for the old sidebar: each filter is a compact pill that
// opens its options in a popover, and every picked value shows as its own
// removable chip after the pills. Pills are lightly brutalist: ink outline and a
// small hard shadow that lifts on hover, presses flat on click, and stays pressed
// while the popover is open.

const FilterPill: FC<{
  label: string;
  active: boolean;
  count?: number;
  icon?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
  children: ReactNode;
}> = ({ label, active, count, icon, onOpenChange, contentClassName, children }) => (
  <Popover onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(
          "group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary pl-3.5 pr-2.5 text-sm font-semibold text-primary shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow,background-color] duration-100 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none data-[state=open]:translate-x-[2px] data-[state=open]:translate-y-[2px] data-[state=open]:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          active ? "bg-secondary" : "bg-white",
        )}>
        {icon}
        {label}
        {count ? (
          <span className="min-w-[18px] rounded-full bg-primary px-1.5 text-center text-[11px] font-bold leading-[18px] text-white tabular-nums">
            {count}
          </span>
        ) : null}
        <ChevronDown className="h-4 w-4 opacity-50 transition-transform group-data-[state=open]:rotate-180" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className={cn("w-64 border-primary/15 p-0", contentClassName)}>
      {children}
    </PopoverContent>
  </Popover>
);

const OptionList: FC<{ name: string; options: FilterType[]; selected: string[]; onToggle: (label: string) => void }> = ({
  name,
  options,
  selected,
  onToggle,
}) => {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;

  return (
    <div>
      {options.length > 8 ? (
        <div className="border-b border-primary/10 p-2">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${name.toLowerCase()}`}
            aria-label={`Search ${name.toLowerCase()}`}
            className="h-8 w-full rounded border border-primary/15 px-2.5 text-sm outline-none focus:border-primary/50"
          />
        </div>
      ) : null}
      <ul className="max-h-72 overflow-y-auto p-1.5">
        {shown.map((option) => (
          <li key={option.value || option.label}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-primary/[0.04]">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={selected.includes(option.label)}
                onChange={() => onToggle(option.label)}
              />
              <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px] border-[1.5px] border-primary bg-white text-primary peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
                <Check className="h-3 w-3 stroke-[3.5]" />
              </span>
              <span className="flex-1 font-medium">{option.label}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 ? <li className="px-2 py-3 text-sm text-primary/50">No matches</li> : null}
      </ul>
    </div>
  );
};

const Chip: FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full bg-secondary pl-2.5 pr-1 text-xs font-semibold text-primary">
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label}`}
      className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
      <X className="h-3 w-3" />
    </button>
  </span>
);

const FilterBar: FC<{ className?: string }> = ({ className }) => {
  const {
    rolesOptions,
    seniorityOptions,
    regionOptions,
    selectedRoles,
    selectedSeniority,
    selectedRegions,
    setSelectedRoles,
    setSelectedSeniority,
    setSelectedRegions,
    handleSelectOption,
    dateRange,
    setDateRange,
    clearFilters,
  } = useFilter();
  // Two months side by side only where they fit; read when the popover opens.
  const [months, setMonths] = useState(2);

  const range = useMemo(() => normalizeDateRange(dateRange), [dateRange]);
  const dateLabel =
    range?.from && range?.to && !isDefaultRange(range) ? `${format(range.from, "LLL d, y")} – ${format(range.to, "LLL d, y")}` : null;

  const groups = [
    { name: "Roles", options: rolesOptions, selected: selectedRoles, set: setSelectedRoles },
    { name: "Seniority", options: seniorityOptions, selected: selectedSeniority, set: setSelectedSeniority },
    { name: "Region", options: regionOptions, selected: selectedRegions, set: setSelectedRegions },
  ];
  const hasChips = dateLabel !== null || groups.some((group) => group.selected.length > 0);

  return (
    <div role="group" aria-label="Filters" className={cn("flex flex-wrap items-center gap-2", className)}>
      <FilterPill
        label="Date range"
        active={dateLabel !== null}
        icon={<CalendarIcon className="h-4 w-4 opacity-60" />}
        contentClassName="w-auto"
        onOpenChange={(open) => {
          if (open) setMonths(window.matchMedia("(min-width: 640px)").matches ? 2 : 1);
        }}>
        <Calendar
          buttonVariant="brutalist"
          mode="range"
          selected={dateRange}
          onSelect={setDateRange}
          defaultMonth={subMonths(range?.to ?? new Date(), months - 1)}
          numberOfMonths={months}
        />
      </FilterPill>

      {groups.map((group) => (
        <FilterPill key={group.name} label={group.name} active={group.selected.length > 0} count={group.selected.length}>
          <OptionList
            name={group.name}
            options={group.options}
            selected={group.selected}
            onToggle={(label) => handleSelectOption(group.set, label)}
          />
        </FilterPill>
      ))}

      {hasChips ? (
        <>
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-primary/15 sm:block" />
          {dateLabel ? <Chip label={dateLabel} onRemove={() => setDateRange(undefined)} /> : null}
          {groups.map((group) =>
            group.selected.map((label) => (
              <Chip key={`${group.name}-${label}`} label={label} onRemove={() => handleSelectOption(group.set, label)} />
            )),
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-1 text-xs font-semibold text-primary/60 underline-offset-2 hover:text-primary hover:underline">
            Clear all
          </button>
        </>
      ) : null}
    </div>
  );
};

export default FilterBar;
