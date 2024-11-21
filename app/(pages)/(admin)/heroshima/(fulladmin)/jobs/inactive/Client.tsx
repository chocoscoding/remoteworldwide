"use client";

import { FC, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BookmarkTile from "@/app/components/main/BookmarkTile";
import { Job } from "@prisma/client";
import { OneJobListType, WithPaginationProps } from "@/types/main";
import withPagination from "@/app/components/main/withPagination";
import AdminJobTile from "@/app/components/ADMIN/AdminJobTile";
import { findInactiveJobs } from "@/libs/query";
import JobTileSkeleton from "@/app/components/main/JobTileSkeleton";
import JobTileSkeletonList from "@/app/components/main/JobTileSkeletonList";

interface InactiveJobsProps extends WithPaginationProps {}

const fetchInactiveJobs = async (currentPage: number) => {
  try {
    const response = await findInactiveJobs(currentPage);
    return { jobs: response.data, total: response.count };
  } catch (error) {
    throw new Error("Something went wrong");
  }
};

const InactiveJobsPage: FC<{ initialJobs: OneJobListType[]; count: number }> = ({ initialJobs, count }) => {
  const PaginatedInactiveJobsComp = withPagination(InactiveJobsComp, fetchInactiveJobs, 50, initialJobs, count);
  return (
    <div className="p-2 w-full max-w-[1400px] m-auto mt-2 min-h-screen">
      <section className="w-full md:px-1 flex gap-12 relative">
        <section className="w-full m-auto px-2 lg:px-0">
          <p className="font-bold text-primary text-3xl mb-2">Inactive Jobs</p>
          <p className="text-primary text-lg font-light">{`These jobs are already inactive and can't be seen by others`}</p>
          <PaginatedInactiveJobsComp />
        </section>
      </section>
    </div>
  );
};
export default InactiveJobsPage;

const InactiveJobsComp: React.FC<InactiveJobsProps> = ({
  jobs,
  currentPage,
  totalJobs,
  totalPages,
  startJobIndex,
  endJobIndex,
  handlePrevious,
  handleNext,
  loading, // Receive loading prop
}) => {
  return (
    <>
      <div className="mb-5 my-10">
        <p className="text-xl mb-2">
          <span className="font-bold text-primary">Jobs</span>{" "}
          <span className="font-extralight text-gray-400 italic text-lg">{`(${totalJobs})`}</span>
        </p>
        <hr />
      </div>
      <div className="grid grid-cols-1">
        {loading ? <JobTileSkeletonList amount={6} /> : jobs.map((job, index) => <AdminJobTile jobDetail={job} key={job.id || index} />)}
      </div>
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
    </>
  );
};
