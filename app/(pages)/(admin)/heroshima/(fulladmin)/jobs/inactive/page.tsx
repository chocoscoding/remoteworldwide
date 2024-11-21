import React from "react";
import InactiveJobs from "./Client";
import { findInactiveJobs } from "@/libs/query";

const Page = async () => {
  const inActiveJobs = await findInactiveJobs(1);
  return <InactiveJobs initialJobs={inActiveJobs.data} count={inActiveJobs.count} />;
};

export default Page;
