"use client";
import { Check, ChevronDown } from "lucide-react";
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
  <div className="my-3">
    <div className="flex justify-between" onClick={toggle}>
      <p className="font-bold relative flex items-center ">
        {title}
        {selectedOptions.length > 0 ? (
          <span className="px-1 bg-primary/90 font-light text-white rounded-full text-[0.5rem] md:text-xs top-0 ml-[6px]">
            {selectedOptions.length}
          </span>
        ) : null}
      </p>
      <ChevronDown className={`opacity-50 cursor-pointer transition-all ${isOpen ? "rotate-180" : ""}`} />
    </div>
    <div className={`transition-all relative ${isOpen ? "h-auto" : "h-0 overflow-hidden"}`}>
      <ul className="h-fit max-h-[320px] overflow-y-auto pt-2 mt-3 pb-2">
        {options.map((option, index) => (
          <li className="mb-3" key={index}>
            {/* The real input stays in the tree (sr-only) so the control keeps
                native checkbox semantics, keyboard support and label
                association; the span beside it is the neobrutalist skin,
                driven off `peer-checked`. */}
            <label htmlFor={`${title}-${index}`} className="group flex items-start gap-[3%] cursor-pointer">
              <input
                id={`${title}-${index}`}
                type="checkbox"
                className="peer sr-only"
                checked={selectedOptions.includes(option.label)}
                onChange={() => handleSelectOption(option.label)}
              />
              <span className="mt-0.5 h-5 w-5 flex-none inline-flex items-center justify-center rounded-[3px] border-2 border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-all group-hover:-translate-x-px group-hover:-translate-y-px group-hover:shadow-[3px_3px_0_0_#222325] peer-checked:bg-secondary peer-checked:translate-x-px peer-checked:translate-y-px peer-checked:shadow-[1px_1px_0_0_#222325] peer-checked:[&>svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-[#e1f073] peer-focus-visible:ring-offset-1">
                <Check className="h-3.5 w-3.5 stroke-[3.5] opacity-0" />
              </span>
              <span className="text-black font-medium relative -top-0.5">
                {option.label} {option.count && <span className="text-sm shrink-0 text-gray-700 font-thin">{`(${option.count})`}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {/* <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-100 to-transparent"></div> */}
    </div>
  </div>
);

export default FilterCategory;
