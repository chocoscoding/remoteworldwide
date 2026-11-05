"use client";
import { FC, ReactNode, useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import { CalendarIcon, Check, ChevronDown, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFilter, type DetailFilterKey } from "@/provider/FilterProvider";
import { isDefaultRange, normalizeDateRange } from "@/lib/dateFilterUtils";
import { FilterType } from "@/types/main";
import { cn } from "@/lib/utils";

// The region and role chips that sat under this bar on /jobs, folded into its pills (owner,
// 2026-11-05). What the backend's Region and Roles lists already cover was dropped (EMEA, LATAM,
// APAC, anywhere in the world; engineering, data, product, design, marketing, sales, customer
// success). The rest is here, on the URL keys the landing pages filter by (app/lib/landing/catalogue.ts):
// Europe and Africa are more `regions` values, the role ones set one-value detail keys.
const EXTRA_REGIONS = ["Europe", "Africa"];
/** `chip`: the removable chip's words after the pills, when the row's own label is too short alone. */
type Extra = { label: string; chip?: string; values: Partial<Record<DetailFilterKey, string>> };
const EXTRAS: Record<string, { heading: string; items: Extra[] }[]> = {
  Roles: [
    {
      heading: "Specialism",
      items: [
        { label: "Frontend development", values: { roleCategory: "frontend" } },
        { label: "Backend development", values: { roleCategory: "backend" } },
        { label: "DevOps", values: { roleCategory: "devops" } },
      ],
    },
  ],
  // No country section under Region (owner, 2026-11-05): US, UK and Canada stay landing pages only
  // (the navbar's Jobs menu and the footer).
};
/**
 * Visa sponsorship, its own pill (owner, 2026-11-05; it began as H1B under Roles). One choice at a
 * time, since the backend takes one visa type: "Any" asks only that sponsorship is offered, a type
 * asks for that visa too. The types are JobDetailsFilters' list, the same keys as /jobs/h1b,
 * /jobs/uk-visa-sponsorship and /jobs/eu-blue-card.
 */
const VISA_OPTIONS: Extra[] = [
  { label: "Any sponsorship", chip: "Visa sponsorship", values: { visaSponsorship: "yes", visaType: "" } },
  ...["H1B", "UK Skilled Worker", "EU Blue Card", "Canada LMIA", "TN", "O1", "L1"].map((type) => ({
    label: type,
    chip: `${type} sponsorship`,
    values: { visaSponsorship: "yes", visaType: type },
  })),
];

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
  compact?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
  children: ReactNode;
}> = ({ label, active, count, icon, compact, onOpenChange, contentClassName, children }) => (
  <Popover onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(
          "group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-3.5 pr-2.5 text-sm font-semibold text-primary br-shadow-press transition-[transform,box-shadow,background-color] duration-100 ease-out data-[state=open]:translate-x-[2px] data-[state=open]:translate-y-[2px] data-[state=open]:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          compact && "h-8 gap-1 pl-3 pr-2 text-xs sm:h-9 sm:gap-1.5 sm:pl-3.5 sm:pr-2.5 sm:text-sm",
          active ? "bg-secondary" : "bg-white",
        )}>
        {icon}
        {label}
        {count ? (
          <span className="min-w-[18px] rounded-full bg-primary px-1.5 text-center text-[11px] font-bold leading-[18px] text-white tabular-nums">
            {count}
          </span>
        ) : null}
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform group-data-[state=open]:rotate-180", compact && "h-3.5 w-3.5 sm:h-4 sm:w-4")} />
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
            <OptionRow label={option.label} checked={selected.includes(option.label)} onToggle={() => onToggle(option.label)} />
          </li>
        ))}
        {shown.length === 0 ? <li className="px-2 py-3 text-sm text-primary/50">No matches</li> : null}
      </ul>
    </div>
  );
};

const OptionRow: FC<{ label: string; checked: boolean; onToggle: () => void }> = ({ label, checked, onToggle }) => (
  <label className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-primary/[0.04]">
    <input type="checkbox" className="peer sr-only" checked={checked} onChange={onToggle} />
    <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px] border-[1.5px] border-primary bg-white text-primary peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
      <Check className="h-3 w-3 stroke-[3.5]" />
    </span>
    <span className="flex-1 font-medium">{label}</span>
  </label>
);

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

// `compact` draws smaller pills below sm (the /jobs board); from sm up they're the usual size.
const FilterBar: FC<{ className?: string; compact?: boolean }> = ({ className, compact }) => {
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
    detailFilters,
    setDetailFilters,
  } = useFilter();
  const extraOn = (item: Extra) =>
    Object.entries(item.values).every(([key, value]) => detailFilters[key as DetailFilterKey] === value);
  // On sets its keys (replacing another country or specialism); off clears them.
  const toggleExtra = (item: Extra) => {
    const on = extraOn(item);
    setDetailFilters(Object.fromEntries(Object.entries(item.values).map(([key, value]) => [key, on ? "" : value])));
  };
  const extrasOn = (name: string) => (EXTRAS[name] ?? []).flatMap((section) => section.items).filter(extraOn);
  const visaOn = VISA_OPTIONS.filter(extraOn);
  const regions = [
    ...regionOptions,
    ...EXTRA_REGIONS.filter((name) => !regionOptions.some((option) => option.label === name)).map((name) => ({ value: name, label: name })),
  ];
  // Two months side by side only where they fit; read when the popover opens.
  const [months, setMonths] = useState(2);

  const range = useMemo(() => normalizeDateRange(dateRange), [dateRange]);
  const dateLabel =
    range?.from && range?.to && !isDefaultRange(range) ? `${format(range.from, "LLL d, y")} – ${format(range.to, "LLL d, y")}` : null;

  const groups = [
    { name: "Roles", options: rolesOptions, selected: selectedRoles, set: setSelectedRoles },
    { name: "Seniority", options: seniorityOptions, selected: selectedSeniority, set: setSelectedSeniority },
    { name: "Region", options: regions, selected: selectedRegions, set: setSelectedRegions },
  ];
  const hasChips =
    dateLabel !== null || visaOn.length > 0 || groups.some((group) => group.selected.length + extrasOn(group.name).length > 0);

  return (
    // Compact, up to 415px wide the four pills take two rows in Manrope, but the fallback font shown
    // until Manrope arrives is narrower and fits them on one between 406 and 415px. The bar then grew
    // a row when the font swapped and pushed the whole list down (CLS 0.26 on /jobs). So it holds
    // two rows' height there from the first paint; from 416px they fit on one row in either font.
    <div
      role="group"
      aria-label="Filters"
      className={cn("flex flex-wrap items-center gap-2", compact && "max-[415px]:min-h-[72px] max-[415px]:content-start", className)}>
      <FilterPill
        label="Date range"
        active={dateLabel !== null}
        compact={compact}
        icon={<CalendarIcon className={cn("h-4 w-4 opacity-60", compact && "h-3.5 w-3.5 sm:h-4 sm:w-4")} />}
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

      {groups.map((group) => {
        const count = group.selected.length + extrasOn(group.name).length;
        return (
          <FilterPill key={group.name} label={group.name} active={count > 0} count={count} compact={compact}>
            <OptionList
              name={group.name}
              options={group.options}
              selected={group.selected}
              onToggle={(label) => handleSelectOption(group.set, label)}
            />
            {(EXTRAS[group.name] ?? []).map((section) => (
              <div key={section.heading} className="border-t border-primary/10 p-1.5">
                <p className="px-2 pb-1 pt-1.5 text-xs font-semibold text-primary">{section.heading}</p>
                <ul>
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <OptionRow label={item.label} checked={extraOn(item)} onToggle={() => toggleExtra(item)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </FilterPill>
        );
      })}

      <FilterPill label="Visa sponsorship" active={visaOn.length > 0} count={visaOn.length} compact={compact}>
        <ul className="p-1.5">
          {VISA_OPTIONS.map((item) => (
            <li key={item.label}>
              <OptionRow label={item.label} checked={extraOn(item)} onToggle={() => toggleExtra(item)} />
            </li>
          ))}
        </ul>
      </FilterPill>

      {hasChips ? (
        <>
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-primary/15 sm:block" />
          {dateLabel ? <Chip label={dateLabel} onRemove={() => setDateRange(undefined)} /> : null}
          {groups.map((group) =>
            group.selected.map((label) => (
              <Chip key={`${group.name}-${label}`} label={label} onRemove={() => handleSelectOption(group.set, label)} />
            )),
          )}
          {groups.map((group) =>
            extrasOn(group.name).map((item) => (
              <Chip key={`${group.name}-extra-${item.label}`} label={item.chip ?? item.label} onRemove={() => toggleExtra(item)} />
            )),
          )}
          {visaOn.map((item) => (
            <Chip key={`visa-${item.label}`} label={item.chip ?? item.label} onRemove={() => toggleExtra(item)} />
          ))}
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
