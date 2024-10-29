"use client";
import JobTile from "@/app/components/main/JobTile";
import SearchBar from "@/app/components/SearchBar";
import FilterSection from "@/app/components/FilterSection";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Home() {
  const totalJobs = 100;
  const jobsPerPage = 50;
  const totalPages = Math.ceil(totalJobs / jobsPerPage);

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

  // Display range for jobs on the current page
  const startJobIndex = (currentPage - 1) * jobsPerPage;
  const endJobIndex = startJobIndex + jobsPerPage;
  return (
    <div className="p-10 w-full max-w-[1300px] m-auto">
      {/* search */}

      {/* section */}
      {/* |- list */}
      {/* |- filter that is fixed on scroll */}
      <h2 className="text-2xl md:text-3xl font-bold text-center">Explore latest and exiciting jobs now</h2>
      <br />
      <div className="w-full max-w-[1500px] mb-28">
        <SearchBar />
      </div>

      <section className="w-full px-1 flex gap-12 relative">
        <section className="w-9/12 max-w-[1300px] m-auto px-3 lg:px-0">
          <div className="mb-5">
            <p className="text-2xl font-extralight text-gray-400 mb-2">
              <span className="font-bold text-primary">Job Opportunities</span> {`(205)`}
            </p>
            <hr />
          </div>
          {Array(25)
            .fill(null)
            .map((_, index) => (
              <JobTile key={index} />
            ))}
          {/* pagination */}
          <div className="mt-5 flex justify-between items-center">
            <p>
              Showing {startJobIndex + 1} to {endJobIndex > totalJobs ? totalJobs : endJobIndex} of {totalJobs}
            </p>
            <div className="flex gap-4 items-center px-4 py-2 border rounded-full">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className={`${currentPage === 1 ? "text-gray-400" : "text-primary"} flex`}>
                <ChevronLeft />
                Previous
              </button>
              <div className="h-[30px] border-none bg-gray-500 w-[0.5px]"></div>
              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className={`${currentPage === totalPages ? "text-gray-400" : "text-primary"} flex`}>
                Next
                <ChevronRight />
              </button>
            </div>
          </div>
        </section>
        <FilterSection />
      </section>
      <br />
    </div>
  );
}
