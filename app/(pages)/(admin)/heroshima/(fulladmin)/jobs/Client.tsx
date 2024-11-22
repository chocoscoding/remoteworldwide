"use client";

import { FC } from "react";
import { OneJobListType } from "@/types/main";
import withPagination from "@/app/components/main/withPagination";
import { findJobsAdmin } from "@/libs/query";

const fetchActiveJobs = async (currentPage: number) => {
  try {
    const response = await findJobsAdmin(currentPage, true);
    return { jobs: response.data, total: response.count };
  } catch (error) {
    throw new Error("Something went wrong");
  }
};

const ActiveJobsPage: FC<{ initialJobs: OneJobListType[]; count: number }> = ({ initialJobs, count }) => {
  const PaginatedActiveJobsComp = withPagination(null, fetchActiveJobs, 50, initialJobs, count);
  return (
    <div className="p-2 w-full max-w-[1400px] m-auto mt-2 min-h-screen">
      <section className="w-full md:px-1 flex gap-12 relative">
        <section className="w-full m-auto px-2 lg:px-0">
          <p className="font-bold text-primary text-3xl mb-2">Active Jobs</p>
          <p className="text-primary text-lg font-light">{`These jobs are already Active and can't be seen by others`}</p>
          <PaginatedActiveJobsComp />
        </section>
      </section>
    </div>
  );
};
export default ActiveJobsPage;
