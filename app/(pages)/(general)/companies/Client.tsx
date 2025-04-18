"use client";

import { FC, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import CompanyTile from "@/app/components/main/CompanyTile";
import { CompanyList } from "@/types/main";
import PaginationControl from "@/app/components/main/PaginationControl";
import CompaniesSkeleton from "@/app/components/skeleton/CompaniesSkeleton";

const CompaniesList: FC<{ initialData: CompanyList[]; totalCompanies: number; forCompany?: boolean }> = ({
  initialData,
  totalCompanies,
  forCompany = false,
}) => {
  const companiesPerPage = 50;
  const totalPages = Math.ceil(totalCompanies / companiesPerPage);
  const [companies, setCompanies] = useState<CompanyList[]>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const initialRef = useRef(0);
  const [searchParam, setSearchParam] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Handlers for pagination buttons
  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage((prevPage) => prevPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  const getCompanies = async (page: number): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/companies?page=${page}&find=${searchParam}`);
      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }
      const companies = await response.json();
      setCompanies(companies.data);
    } catch (error) {
      console.error("Error fetching companies:", error);
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    const fetchTimeout = setTimeout(() => {
      if (initialRef.current === 0) {
        initialRef.current = 1;
        return;
      }
      const fetchCompanies = async () => {
        return await getCompanies(currentPage);
      };
      fetchCompanies();
    }, 500);
    return () => clearTimeout(fetchTimeout);
  }, [currentPage, searchParam]);

  // Display range for jobs on the current page
  const startCompanyIndex = (currentPage - 1) * companiesPerPage;
  const endCompnayIndex = startCompanyIndex + companiesPerPage;
  return (
    <div className="p-2 w-full max-w-[1400px] m-auto mt-5 lg:mt-10 min-h-screen">
      {/* search */}

      {/* section */}
      {/* |- list */}
      {/* |- filter that is fixed on scroll */}

      <section className="w-full md:px-1 flex gap-12 relative">
        <section className="w-full m-auto px-2 lg:px-0">
          <div className="flex justify-between flex-wrap-reverse items-center">
            <p className="md:text-2xl mb-2 flex-shrink-0">
              <span className="font-bold text-primary">Companies</span>{" "}
              <span className="font-extralight text-gray-400 italic text-sm md:text-lg">{`(A-Z)`}</span>
            </p>

            <div className="flex border border-black rounded-md items-center w-full sm:w-[300px] bg-white overflow-hidden gap-2 flex-shrink-0 mb-3">
              <input
                placeholder={`search company`}
                className={`h-10 px-1 flex-1 bg-transparent outline-none`}
                value={searchParam}
                onChange={(e) => setSearchParam(e.target.value)}
              />
              <button className={`h-10 aspect-square bg-primary text-white flex items-center justify-center flex-shrink-0`}>
                <Search />
              </button>
            </div>
          </div>
          <hr className="mb-5" />

          {isLoading ? (
            <div className="min-h-screen flex flex-col items-center w-full">
              <CompaniesSkeleton amount={15} />
            </div>
          ) : null}
          {companies.length === 0 && (
            <div className="h-[60vh] grid place-items-center">
              <div className="text-center text-gray-500">No companies found.</div>
            </div>
          )}
          {isLoading ? null : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {companies.map((company, index) => (
                <CompanyTile forCompany={forCompany} companyData={company} key={index} />
              ))}
            </div>
          )}

          {/* pagination */}
          <PaginationControl
            handlePrevious={handlePrevious}
            handleNext={handleNext}
            currentPage={currentPage}
            totalPages={totalPages}
            dataTotal={totalCompanies}
            startIndex={startCompanyIndex}
            endIndex={endCompnayIndex}
            scrollToTop
          />
        </section>
      </section>
      <br />
    </div>
  );
};
export default CompaniesList;
