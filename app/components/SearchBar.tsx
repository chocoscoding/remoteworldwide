"use client";
import { Search, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SearchBar: React.FC<{ activeSearch?: boolean }> = ({ activeSearch = false }) => {
  const [searchValue, setSearchValue] = useState("");
  const searchParams = useSearchParams();
  const { push } = useRouter();
  const pathname = usePathname();

  // Determine if the 'search' param is present
  const isSearchActive = useMemo(() => {
    const searchParamValue = searchParams.get("search");
    return searchParamValue && searchParamValue.trim() !== "";
  }, [searchParams]);

  useEffect(() => {
    if (activeSearch) {
      const searchParamValue = searchParams.get("search");
      if (searchParamValue) {
        setSearchValue(decodeURIComponent(searchParamValue));
      }
    }
  }, [activeSearch, searchParams]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    params.delete("search");
    if (searchValue) {
      params.append("search", searchValue);
    }
    push(pathname + "?" + params.toString());
  };

  const clearSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    setSearchValue("");
    push(pathname + "?" + params.toString());
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full h-[3.5rem] md:h-[4.5rem] outline outline-2 outline-black rounded-md bg-white drop-shadow-primary2 p-1.5 md:p-3 flex">
      <div className="flex flex-1 items-center gap-4 px-3">
        <Search className="text-primary hidden md:block" />
        <input
          className="h-full w-full outline-none border-none text-sm md:text-xl"
          type="text"
          placeholder="search 1000+ remote jobs"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        {isSearchActive && (
          <button type="button" className="text-gray-500 hover:text-gray-800" onClick={clearSearch} aria-label="Clear search">
            <X />
          </button>
        )}
        {!activeSearch ? (
          <Link
            href={`/jobs${searchValue ? `?search=${encodeURIComponent(searchValue)}` : ""}`}
            className="px-4 py-1.5 md:py-0 md:px-7 md:w-auto w-fit h-auto md:h-full text-white bg-primary rounded-sm hover:rounded-md transition-all flex items-center justify-center gap-3">
            <InnerContent />
          </Link>
        ) : (
          <button
            className="px-4 py-1.5 md:py-0 md:px-7 md:w-auto w-fit h-auto md:h-full text-white bg-primary rounded-sm hover:rounded-md transition-all items-center flex justify-center gap-3"
            type="submit">
            <InnerContent />
          </button>
        )}
      </div>
    </form>
  );
};

export default SearchBar;

const InnerContent: React.FC = () => (
  <>
    <span className="hidden md:block">Search</span>
    <span className="md:hidden block">
      <Search className="md:w-auto w-4" />
    </span>
  </>
);
