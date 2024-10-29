// FILE: components/SearchBar.tsx
import { Search } from "lucide-react";
import React from "react";

const SearchBar: React.FC = () => {
  return (
    <div className="w-full h-[3.5rem] md:h-[4.5rem] outline outline-2 outline-black rounded-md bg-white drop-shadow-primary p-1.5 md:p-3 flex">
      <div className="flex flex-1 items-center gap-4 px-3">
        <Search className="text-primary hidden md:block" />
        <input className="h-full w-full outline-none border-none text-sm md:text-xl" type="text" placeholder="search 2000+ remote jobs" />
      </div>
      <button className="px-5 md:px-7 h-auto md:h-full text-white bg-primary">
        <span className="hidden md:block">Search</span>
        <span className="md:hidden block">
          <Search className="md:w-auto w-4" />
        </span>
      </button>
    </div>
  );
};

export default SearchBar;
