"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFilter } from "@/provider/FilterProvider";
import { DateRange } from "react-day-picker";

const normalizeDateRange = (range?: DateRange) => {
  if (!range?.from || !range?.to) return range;
  return range.from <= range.to ? range : { from: range.to, to: range.from };
};

interface DateRangeFilterProps {
  isOpen: boolean;
  toggle: () => void;
}

const DateRangeFilter = ({ isOpen, toggle }: DateRangeFilterProps) => {
  const { dateRange, setDateRange } = useFilter();
  const normalizedRange = useMemo(() => normalizeDateRange(dateRange), [dateRange]);
  const from = normalizedRange?.from;
  const to = normalizedRange?.to;

  return (
    <div className="my-4">
      <div className="flex justify-between" onClick={toggle}>
        <p className="font-bold">Date range</p>
        <ChevronDown className={`opacity-50 cursor-pointer transition-all ${isOpen ? "rotate-180" : ""}`} />
      </div>
      <div className={`transition-all relative ${isOpen ? "h-auto" : "h-0 overflow-hidden"}`}>
        <div className="pt-2 mt-3 pb-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="brutalist" className="w-full justify-start gap-2 px-2.5 font-normal">
                <CalendarIcon className="h-4 w-4" />
                {from && to ? (
                  <>
                    {format(from, "LLL dd, y")} - {format(to, "LLL dd, y")}
                  </>
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                buttonVariant={"brutalist"}
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                defaultMonth={to}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

export default DateRangeFilter;
