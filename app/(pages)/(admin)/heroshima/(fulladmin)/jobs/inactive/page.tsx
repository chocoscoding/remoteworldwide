import React from "react";
import InactiveJobs from "./Client";
import { findJobsAdmin } from "@/libs/query";

const Page = async () => {
  const inActiveJobs = await findJobsAdmin(1, false);
  return <InactiveJobs initialJobs={inActiveJobs.data} count={inActiveJobs.count} />;
};

export default Page;
