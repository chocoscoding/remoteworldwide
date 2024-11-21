import React from "react";
import ActiveJobsPage from "./Client";
import { findJobsAdmin } from "@/libs/query";
import { revalidatePath } from "next/cache";

const Page = async () => {
  revalidatePath("/");
  const inActiveJobs = await findJobsAdmin(1, true);
  return <ActiveJobsPage initialJobs={inActiveJobs.data} count={inActiveJobs.count} />;
};

export default Page;
