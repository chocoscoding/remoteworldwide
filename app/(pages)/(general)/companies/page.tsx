"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import CompanyTile from "../../../components/main/CompanyTile";
import { CompanyList } from "@/types/main";

export default function Home() {
  const dummyData: CompanyList = {
    name: "Lorem Ipsum",
    about: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    logo: "/images/telegram.png",
    _count: {
      jobs: 10,
    },
  };
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
    <div className="p-2 w-full max-w-[1400px] m-auto mt-10">
      {/* search */}

      {/* section */}
      {/* |- list */}
      {/* |- filter that is fixed on scroll */}

      <section className="w-full md:px-1 flex gap-12 relative">
        <section className="w-full  m-auto px-2 lg:px-0">
          <div className="mb-5">
            <p className="text-2xl mb-2">
              <span className="font-bold text-primary">Companies</span>{" "}
              <span className="font-extralight text-gray-400 italic text-lg">{`(A-Z)`}</span>
            </p>
            <hr />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array(25)
              .fill(null)
              .map((_, index) => (
                <CompanyTile companyData={dummyData} key={index} />
              ))}
          </div>

          {/* pagination */}
          <br />
          <hr />
          <div className="mt-5 flex justify-between items-center sm:flex-row gap-2 sm:gap-0 flex-col">
            <p className="flex-shrink-0">
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
      </section>
      <br />
    </div>
  );
}
