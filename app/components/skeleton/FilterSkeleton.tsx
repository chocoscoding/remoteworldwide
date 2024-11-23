"use client";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";
import { useFilter } from "@/provider/FilterProvider";
import { FC } from "react";

const FilterSkeleton: FC<{ className?: string }> = ({ className }) => {
  const { toggleMobileFilter } = useFilter();
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
      <header className="flex justify-between">
        <button className="bg-gray-400 rounded-md w-[100px] h-6 animate-pulse"></button>
        <button className="bg-gray-400 rounded-md w-[50px] h-6 animate-pulse"></button>
      </header>
      <br />

      {Array(4)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="mb-6">
            <div className="flex justify-between gap-2 ">
              <div className="font-bold w-full h-6 rounded-md bg-gray-300 animate-pulse"></div>
              <div className="font-bold w-[30px] h-6 rounded-md bg-gray-300 animate-pulse"></div>
            </div>
          </div>
        ))}
    </section>
  );
};

export default FilterSkeleton;
