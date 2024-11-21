import { FetchDataFunction, OneJobListType, WithPaginationProps } from "@/types/main";
import { Job } from "@prisma/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState, useEffect } from "react";
import JobTileSkeletonList from "./JobTileSkeletonList";
import AdminJobTile from "../ADMIN/AdminJobTile";

// Higher-Order Component to handle pagination with loading state
const withPagination = (
  WrappedComponent: React.ComponentType<WithPaginationProps> | null,
  fetchDataFunction: FetchDataFunction,
  jobsPerPage: number = 50,
  initialJobs: OneJobListType[] = [],
  initialTotalJobs: number = 0
) => {
  return function WithPagination(props: any) {
    const [jobs, setJobs] = useState<OneJobListType[]>(initialJobs);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalJobs, setTotalJobs] = useState<number>(initialTotalJobs);
    const [loading, setLoading] = useState<boolean>(false); // Loading state added

    // Fetch jobs when the component mounts or when the currentPage changes
    useEffect(() => {
      const fetchJobs = async () => {
        setLoading(true); // Set loading to true before fetching data
        try {
          const { jobs: fetchedJobs, total } = await fetchDataFunction(currentPage, jobsPerPage);
          setJobs(fetchedJobs);
          setTotalJobs(total);
        } catch (error) {
          console.error("Failed to fetch jobs:", error);
        } finally {
          setLoading(false); // Set loading to false after the fetch completes (success or error)
        }
      };
      if (currentPage > 1) {
        fetchJobs();
      }
    }, [currentPage, jobsPerPage]);

    // Pagination logic
    const totalPages = Math.ceil(totalJobs / jobsPerPage);
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
      <div>
        {WrappedComponent ? (
          <WrappedComponent
            {...props}
            jobs={jobs}
            currentPage={currentPage}
            totalJobs={totalJobs}
            totalPages={totalPages}
            startJobIndex={startJobIndex}
            endJobIndex={endJobIndex}
            handlePrevious={handlePrevious}
            handleNext={handleNext}
            loading={loading} // Pass loading state to the wrapped component
          />
        ) : (
          <>
            <div className="mb-5 my-10">
              <p className="text-xl mb-2">
                <span className="font-bold text-primary">Jobs</span>{" "}
                <span className="font-extralight text-gray-400 italic text-lg">{`(${totalJobs})`}</span>
              </p>
              <hr />
            </div>
            <div className="grid grid-cols-1">
              {loading ? (
                <JobTileSkeletonList amount={6} />
              ) : (
                jobs.map((job, index) => <AdminJobTile jobDetail={job} key={job.id || index} />)
              )}
            </div>
          </>
        )}
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
      </div>
    );
  };
};

export default withPagination;
