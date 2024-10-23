"use client";
import { ChevronDown } from "lucide-react";
import React, { FC } from "react";

interface FilterCategoryType {
  title: string;
  isOpen: boolean;
  toggle: () => void;
  options: Array<{ label: string; count?: number }>;
  selectedOptions: string[];
  handleSelectOption: (option: string) => void;
}
// Reusable FilterCategory component
const FilterCategory: FC<FilterCategoryType> = ({ title, isOpen, toggle, options, handleSelectOption, selectedOptions }) => (
  <div className="mt-6">
    <div className="flex justify-between">
      <p className="font-bold">{title}</p>
      <ChevronDown onClick={toggle} className={`opacity-50 cursor-pointer transition-all ${isOpen ? "rotate-180" : ""}`} />
    </div>
    <div className={`transition-all relative ${isOpen ? "h-auto" : "h-0 overflow-hidden"}`}>
      <ul className="h-fit max-h-[320px] overflow-y-auto pt-2 mt-3 pb-2">
        {options.map((option, index) => (
          <li className="flex items-start gap-[3%] mb-3" key={index}>
            <input
              id={`${title}-${index}`}
              type="checkbox"
              className="accent-gray-600 w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded"
              checked={selectedOptions.includes(option.label)}
              onChange={() => handleSelectOption(option.label)}
            />
            <label htmlFor={`${title}-${index}`} className="text-black font-medium relative -top-0.5">
              {option.label} {option.count && <span className="text-sm shrink-0 text-gray-700 font-thin">{`(${option.count})`}</span>}
            </label>
          </li>
        ))}
      </ul>
      {/* <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-100 to-transparent"></div> */}
    </div>
  </div>
);

export default FilterCategory;
