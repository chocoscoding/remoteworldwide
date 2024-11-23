"use client";
import React, { useState, useEffect } from "react";
import JobTile from "./JobTile";
import { ChevronRight, ChevronLeft, AlertCircle } from "lucide-react";
import JobTileSkeleton from "./JobTileSkeleton";

const JobsContainer = () => {
  const totalJobs = 100;
  const jobsPerPage = 50;
  const totalPages = Math.ceil(totalJobs / jobsPerPage);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Loading and error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Simulate fetching data
  useEffect(() => {
    setLoading(true);
    setError(null);

    // Simulate an API call
    setTimeout(() => {
      // Simulate a successful fetch
      setLoading(false);
      // Uncomment the following line to simulate an error
      // setError("Failed to fetch jobs");
    }, 2000);
  }, [currentPage]);

  // Display range for jobs on the current page
  const startJobIndex = (currentPage - 1) * jobsPerPage;
  const endJobIndex = startJobIndex + jobsPerPage;

  if (loading) {
    return (
      <>
        {Array(10)
          .fill(null)
          .map((_, index) => (
            <JobTileSkeleton key={index} />
          ))}
      </>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-start h-[90%]">
        <AlertCircle className="text-red-500 w-12 h-12 mb-2" />
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (totalJobs < 1) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p>No job found</p>
      </div>
    );
  }

  return (
    <div>
      {Array(25)
        .fill(null)
        .map((_, index) => (
          <JobTile
            {...{
              id: "1234567890-",
              title: "jkljlkjd dkjsljds ",
              company: {
                logo: "/images/telegram.png",
                name: "Telegraa",
              },
              slug: "jkljlkjd-dkjsljds-95d2b013007a4a6851041ef934b6ef8e35001732182066359",
              category: "sksks",
              region: "EMEA",
              jobType: "dkd",
              seniority: "Mid-level",
              createdAt: new Date("2024-11-21T09:41:06.360Z"),
            }}
            key={index}
          />
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
    </div>
  );
};

export default JobsContainer;
