"use client";

import { useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import BookmarkTile from "../components/main/BookmarkTile";

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
    <div className="p-1 xl:p-10 w-full max-w-[1400px] m-auto mt-10">
      {/* search */}

      {/* section */}
      {/* |- list */}
      {/* |- filter that is fixed on scroll */}

      <section className="w-full md:px-1 flex gap-12 relative">
        <section className="w-full  m-auto px-2 lg:px-0">
          <p className="font-bold text-primary text-3xl mb-2">Hello Camron</p>
          <p className="text-primary text-lg font-light">You saved some jobs. Do apply to them before they get stale</p>
          <div className="mb-5 my-10">
            <p className="text-xl mb-2">
              <span className="font-bold text-primary">My Jobs</span>{" "}
              <span className="font-extralight text-gray-400 italic text-lg">{`(200)`}</span>
            </p>
            <hr />
          </div>
          <div className="grid grid-cols-1 ">
            {/* main */}
            {Array(jobsPerPage)
              .fill(0)
              .map((_, index) => (
                <BookmarkTile key={index} />
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
