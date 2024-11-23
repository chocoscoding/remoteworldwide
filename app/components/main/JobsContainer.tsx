"use client";
import React, { useState, useEffect } from "react";
import JobTile from "./JobTile";
import { ChevronRight, ChevronLeft, AlertCircle } from "lucide-react";
import JobTileSkeleton from "./JobTileSkeleton";
import { JobTileType } from "@/types/main";
import { Settings2 } from "lucide-react";
import { useFilter } from "@/provider/FilterProvider";
import { useSearchParams } from "next/navigation";

const JobsContainer = () => {
  const { toggleMobileFilter, activeFilterCount } = useFilter();
  const jobsPerPage = 50;
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const totalPages = Math.ceil(totalJobs / jobsPerPage);
  const [jobs, setJobs] = useState<JobTileType[]>([]);
  const searchParams = useSearchParams();

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
  const getJobs = async (page: number): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs?page=${page}&${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch jobs");
      }
      const jobs = await response.json();
      setTotalJobs(jobs.count);
      setJobs(jobs.data);
    } catch (error: any) {
      setError("Error fetching jobs:" + error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const fetchJobs = async () => {
      return await getJobs(currentPage);
    };
    fetchJobs();
  }, [currentPage, searchParams]);

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
        <AlertCircle className="text-red-500 w-[20vw] md:w-[10vw] h-[20vh] md:h-[10vh] mt-4 mb-2" />
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
      <div className="mb-5 w-full">
        <div className="w-full flex justify-between items-center">
          <p className="text-xl md:text-2xl font-extralight text-gray-400 mb-2">
            <span className="font-bold text-primary">Job Opportunities</span> <span className="text-base">{`(${totalJobs})`}</span>
          </p>

          <div className="relative block sm:hidden">
            <Settings2 className="" onClick={toggleMobileFilter} />
            {activeFilterCount > 0 ? (
              <span className=" absolute -right-2 -top-2.5 px-1 bg-primary font-light text-white rounded-full text-[0.5rem] ml-[6px]">
                {activeFilterCount}
              </span>
            ) : null}
          </div>
        </div>
        <hr />
      </div>

      {jobs.map((job, index) => (
        <JobTile {...job} key={index} />
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
