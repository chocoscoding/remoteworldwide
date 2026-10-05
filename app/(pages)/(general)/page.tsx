import Header from "@/app/components/Header";
import JobListSection from "./JobListSection";
import Link from "next/link";
import { fetchLatestJobs, getAllActiveJobsCount } from "@/libs/query";
import type { Metadata } from "next";
import { absoluteUrl } from "@/app/lib/seo";
import { TOOLS, toolPath } from "@/app/lib/tools/catalogue";
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
        <div className="w-full flex justify-center">
          <Link href={"/jobs"} className="bg-secondary drop-shadow-secondary2 text-primary px-16 py-3 text-lg font-bold rounded-md my-1">
            View all jobs
          </Link>
        </div>
      </section>

      {/* The AI tools, each a crawlable link to its own page: links from the homepage are what
          Google weighs most when it picks the sitelinks under the site's result. */}
      <section className="w-full max-w-[1200px] m-auto px-3 xl:px-0 mt-16" aria-labelledby="home-tools-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 id="home-tools-heading" className="text-xl md:text-2xl xl:text-3xl font-bold">
            Then land it, with AI backup
          </h3>
          <Link href="/tools" className="text-sm font-bold underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary">
            All AI tools
          </Link>
        </div>
        {/* Four across on a wide screen, so the seven tools sit as four and three. */}
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool) => (
            <li key={tool.key}>
              <Link href={toolPath(tool)} className="group flex h-full flex-col rounded-[18px] bg-white p-5 br-plain-press">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary/50">{tool.step}</span>
                <span className="mt-1 text-lg font-extrabold">{tool.name}</span>
                <span className="mt-1.5 text-sm leading-relaxed text-primary/70">{tool.card}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* <div className="w-full justify-center items-center p-2 my-10 mt-30">
        <h3 className="w-full text-xl font-bold text-neutral-600 relative top-10 left-5">Testimonials</h3>
        <StaggerTestimonials />
      </div> */}
      <br />
    </div>
  );
}
