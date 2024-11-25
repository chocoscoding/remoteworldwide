import Header from "@/app/components/Header";
import JobListSection from "./JobListSection";
import Link from "next/link";
import { fetchLatestJobs, getAllActiveJobsCount } from "@/libs/query";

const getLatestJobs = async () => {
  try {
    const latestJobs = await fetchLatestJobs(10);
    return latestJobs.data;
  } catch (error) {
    return [];
  }
};
export default async function Home() {
  const jobsCount = await getAllActiveJobsCount();
  const latestJobs = await getLatestJobs();

  return (
    <div>
      <Header count={jobsCount.count} />
      <br />
      <section className="w-full max-w-[1200px] m-auto px-3 xl:px-0">
        <h2 className="text-xl md:text-2xl xl:text-3xl font-bold">Explore latest and exciting jobs now</h2>
        <br />

        <JobListSection latestJobs={latestJobs} />
        <div className="w-full flex justify-center">
          <Link
            href={"/jobs"}
            className="bg-secondary drop-shadow-secondary2-hover text-primary px-16 py-3 text-lg font-bold hover:rounded-md transition-all my-1">
            View all jobs
          </Link>
        </div>
      </section>
      <br />
    </div>
  );
}
