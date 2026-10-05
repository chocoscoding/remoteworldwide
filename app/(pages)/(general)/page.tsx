import Header from "@/app/components/Header";
import JobListSection from "./JobListSection";
import Link from "next/link";
import { fetchLatestJobs, getAllActiveJobsCount } from "@/libs/query";
import type { Metadata } from "next";
import { absoluteUrl } from "@/app/lib/seo";
export const revalidate = 86400; // 3600 * 24

// The brand leads, so a search for it matches the homepage first; the rest is what the
// site is, in the words people search with. Under ~60 and ~155 characters so Google
// shows them whole.
const TITLE = "Remote Worldwide: Worldwide Remote Jobs and AI Job Tools";
const DESCRIPTION =
  "Vetted remote jobs you can do from anywhere, plus AI tools to land them: tailored resumes, ATS checks, cover letters and voice mock interviews. Start free.";
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: absoluteUrl("/"), title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
};
const getLatestJobs = async () => {
  try {
    const latestJobs = await fetchLatestJobs(10);
    return latestJobs.data;
  } catch {
    return [];
  }
};
// Null when the count can't be read: the hero leaves the line out rather than show a made-up number.
const getCounts = async (): Promise<number | null> => {
  try {
    const latestJobs = await getAllActiveJobsCount();
    return typeof latestJobs.count === "number" ? latestJobs.count : null;
  } catch {
    return null;
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
        <div className="w-full flex items-center justify-center">
          <Link
            href={"/jobs"}
            className="bg-secondary drop-shadow-secondary2 text-primary px-16 py-3 text-lg font-bold rounded-md my-1">
            View all jobs
          </Link>
          <p className="text-sm font-bold text-primary/70 my-2">or</p>

          <Link
            href={"/tools"}
            className="bg-secondary drop-shadow-secondary2 text-primary px-16 py-3 text-lg font-bold rounded-md my-1">
            View all our <b>features</b>
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
