"use client";
import React, { useState, useEffect, useMemo } from "react";
import JobTile from "./JobTile";
import { AlertCircle } from "lucide-react";
import JobTileSkeleton from "./JobTileSkeleton";
import { JobTileType } from "@/types/main";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PaginationControlNew from "./PaginationControlNew";
// import PaginationControl from "./PaginationControl";

const JobsContainerForSearch = () => {
  const jobsPerPage = 50;
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const totalPages = Math.ceil(totalJobs / jobsPerPage);
  const [jobs, setJobs] = useState<JobTileType[]>([]);
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  const router = useRouter();
  const pathname = usePathname();

  // Pagination state
  const currentPage = useMemo(() => {
    const page = searchParams.get("page");
    return page ? ~~page : 1;
  }, [searchParams]);

  // Loading and error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handlers for pagination buttons
  const handlePrevious = () => {
    if (currentPage > 1) {
      params.delete("page");
      params.append("page", `${currentPage - 1}`);
      router.replace(pathname + "?" + params.toString());
      // setCurrentPage((prevPage) => prevPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      params.delete("page");
      params.append("page", `${currentPage + 1}`);
      router.replace(pathname + "?" + params.toString());
      // setCurrentPage((prevPage) => prevPage + 1);
    }
  };
  const handlePageChange = (page: number) => {
    params.delete("page");
    params.append("page", `${page}`);
    router.replace(pathname + "?" + params.toString());
    // setCurrentPage(page);
  };

  // Simulate fetching data
  const getJobs = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs?${searchParams.toString()}`);
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
    const timeout = setTimeout(() => {
      getJobs();
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchParams]);

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
      <div className="flex flex-col items-center justify-center h-[50vh] text-center md:h-[90%]">
        <p className="font-bold text-xl mb-2">No opening found for now 😟</p>
        <p className="">Clear filters or search queries to see more oppotunities 😇</p>
      </div>
    );
  }

  return (
    <div>
      {jobs.map((job, index) => (
        <JobTile {...job} key={index} />
      ))}

      {/* pagination */}
      <PaginationControlNew
        handlePrevious={handlePrevious}
        handleNext={handleNext}
        onPageChange={handlePageChange}
        currentPage={currentPage}
        totalPages={totalPages}
        dataTotal={totalJobs}
        startIndex={startJobIndex}
        endIndex={endJobIndex}
      />
    </div>
  );
};

export default JobsContainerForSearch;
