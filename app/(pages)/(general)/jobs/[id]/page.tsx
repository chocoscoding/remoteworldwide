import CompanySection from "@/app/components/main/job/CompanySection";
import JobDescription from "@/app/components/main/job/JobDescription";
import NotFound from "@/app/components/NotFound";
import { auth } from "@/auth";
import { checkBookmarkForUser } from "@/libs/query";
import { prisma } from "@/prisma";
import { JobAndCompany } from "@/types/main";
import { Job } from "@prisma/client";

const fetchJob = async (slug: string): Promise<JobAndCompany | null> => {
  try {
    const job = await prisma.job.findUnique({
      where: {
        slug,
      },
      include: {
        company: true,
      },
    });
    return job;
  } catch (error) {
    throw new Error("Something went wrong");
  }
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const jobSlug = decodeURIComponent((await params).id);
  const JOB = await fetchJob(jobSlug);
  const { company: companyDetails, ..._jobDetails } = JOB!;
  // fetch data
  const imageUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/og/job?title=${encodeURIComponent(_jobDetails.title)}&type=${encodeURIComponent(
    _jobDetails.region
  )}&company=${encodeURIComponent(companyDetails.name)}`;
  return {
    title: _jobDetails.title,
    descrption: `Remoteworldwide - ${_jobDetails.title}`,
    openGraph: {
      images: imageUrl,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const jobSlug = decodeURIComponent((await params).id);
  const JOB = await fetchJob(jobSlug);

  if (!JOB) return <NotFound buttonType="back" title="Job" />;
  const userSession = await auth();

  const { company: companyDetails, ..._jobDetails } = JOB!;
  const jobDetails = _jobDetails as unknown as Job;
  let hasUserBookmarked = undefined;
  if (userSession?.user) {
    const _hasUserBookmarked = await checkBookmarkForUser(userSession.user.id, jobDetails.id);
    if (_hasUserBookmarked.data?.id) {
      hasUserBookmarked = true;
    }
  }

  return (
    <main className="min-h-screen w-full">
      <section className="w-full m-auto max-w-[1200px] min-h-screen my-2 p-3">
        {/* main section */}
        <section className="grid grid-cols-1 md:grid-cols-10 h-full w-full gap-5 md:gap-10">
          {/* |-job info */}
          <div className="col-span-full md:col-span-7 h-fit">
            <JobDescription hasUserBookmarked={hasUserBookmarked} showBookmark={true} data={jobDetails} />
          </div>
          {/* |-company info */}
          <div className="col-span-full -order-1 md:order-2 md:col-span-3 h-fit">
            <CompanySection companyDetails={companyDetails} />
          </div>
        </section>
      </section>
    </main>
  );
}
