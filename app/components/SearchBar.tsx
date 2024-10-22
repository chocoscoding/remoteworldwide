// FILE: components/SearchBar.tsx
import { Search } from "lucide-react";
import React from "react";

const SearchBar: React.FC = () => {
  return (
    <div className="w-full h-20 outline outline-2 outline-black rounded-md bg-white drop-shadow-primary p-3 flex">
      <div className="flex flex-1 items-center gap-4 px-3">
        <Search className="text-primary" />
        <input className="h-full w-full outline-none border-none text-xl" type="text" placeholder="search 2000+ remote jobs" />
      </div>
      <button className="px-7 h-full text-white bg-primary">
        <span className="hidden md:block">Search</span>
        <span className="md:hidden block">
          <Search />
        </span>
      </button>
    </div>
  );
};

export default SearchBar;
