import React from "react";
import ActiveJobsPage from "./Client";
import { findJobsAdmin } from "@/libs/query";

const Page = async () => {
  const inActiveJobs = await findJobsAdmin(1, true);
  return <ActiveJobsPage initialJobs={inActiveJobs.data} count={inActiveJobs.count} />;
};

export default Page;
