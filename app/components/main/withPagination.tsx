import { FetchDataFunction, OneJobListType, WithPaginationProps } from "@/types/main";
import { Job } from "@prisma/client";
import React, { useState, useEffect } from "react";

// Higher-Order Component to handle pagination with loading state
const withPagination = (
  WrappedComponent: React.ComponentType<WithPaginationProps>,
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
    );
  };
};

export default withPagination;
