import Header from "@/app/components/Header";
import JobListSection from "./JobListSection";
import Link from "next/link";
import { fetchLatestJobs, getAllActiveJobsCount } from "@/libs/query";
// import { revalidatePath } from "next/cache";
export const revalidate = 3600 * 24;
const getLatestJobs = async () => {
  try {
    const latestJobs = await fetchLatestJobs(10);
    return latestJobs.data;
  } catch {
    return [];
  }
};
const getCounts = async () => {
  try {
    const latestJobs = await getAllActiveJobsCount();
    return latestJobs.count;
  } catch {
    return 10;
  }
};
export default async function Home() {
  const jobsCount = await getCounts();
  const latestJobs = await getLatestJobs();

  return (
    <div>
      {/* the header of the page */}
      <Header count={jobsCount} />
      <br />
      <section className="w-full max-w-[1200px] m-auto px-3 xl:px-0">
        <h3 className="text-xl md:text-2xl xl:text-3xl font-bold">Explore latest and exciting jobs now</h3>
        <br />

        {/* few jobs list */}
        <JobListSection latestJobs={latestJobs} />
        <div className="w-full flex justify-center">
          <Link href={"/jobs"} className="bg-secondary drop-shadow-secondary2 text-primary px-16 py-3 text-lg font-bold rounded-md my-1">
            View all jobs
          </Link>
        </div>
      </section>

      {/* <div className="w-full justify-center items-center p-2 my-10 mt-30">
        <h3 className="w-full text-xl font-bold text-neutral-600 relative top-10 left-5">Testimonials</h3>
        <StaggerTestimonials />
      </div> */}
      <br />
    </div>
  );
}
