"use client";

import { FC } from "react";
import { OneJobListType } from "@/types/main";
import withPagination from "@/app/components/main/withPagination";
import { findJobsAdmin } from "@/libs/query";

const fetchInactiveJobs = async (currentPage: number) => {
  try {
    const response = await findJobsAdmin(currentPage, false);
    return { jobs: response.data, total: response.count };
  } catch (error) {
    throw new Error("Something went wrong");
  }
};

const InactiveJobsPage: FC<{ initialJobs: OneJobListType[]; count: number }> = ({ initialJobs, count }) => {
  const PaginatedInactiveJobsComp = withPagination(null, fetchInactiveJobs, 50, initialJobs, count);
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
