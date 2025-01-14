import { prisma } from "@/prisma";
import { FilterData, FilterType } from "@/types/main";
import { Job } from "@prisma/client";
import NotFound from "@/app/components/NotFound";
import UpdateJob from "./Client";
import { randomUUID } from "crypto";

const fetchJob = async (slug: string): Promise<(Job & { company: { name: string } }) | null> => {
  try {
    const job = await prisma.job.findUnique({
      where: {
        slug,
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    });
    return job;
  } catch (error) {
    throw new Error("Something went wrong");
  }
};
const getAllFilters = async (): Promise<FilterData> => {
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/filters?"+randomUUID(), { cache: "no-store" });
    if (!res.ok) {
      throw new Error("error");
    }
    const data: Promise<{ data: FilterData }> = await res.json();
    return (await data).data;
  } catch (error) {
    throw new Error("Failed to fetch filters.");
  }
};

const getAllCompanies = async () => {
  try {
    const companies = (await prisma.company.aggregateRaw({
      pipeline: [
        {
          $project: {
            _id: { $toString: "$_id" }, // Selects the `_id` field
            name: 1, // Selects the `name` field
          },
        },
        {
          $project: {
            value: "$_id", // Maps `_id` to `value`
            label: "$name", // Maps `name` to `label`
          },
        },
      ],
    })) as unknown as FilterType[];
    return companies;
  } catch (error) {
    throw new Error("Failed to fetch companies.");
  }
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const jobSlug = decodeURIComponent((await params).id);
  const JOB = await fetchJob(jobSlug);
  const allCompanies = await getAllCompanies();
  const filters = await getAllFilters();

  if (!JOB) return <NotFound buttonType="link" title="Job" link="/heroshima/companies/create" />;
  return (
    <>
      <UpdateJob job={JOB} allCompanies={allCompanies} filters={filters} key={"createJobPage"} />
    </>
  );
}
