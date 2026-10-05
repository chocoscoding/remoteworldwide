import { prisma } from "@/prisma";

// The job board's search: GET /api/jobs answers with it, and the /jobs page runs it on
// the server for the first paint, so the list (and every job link) is in the HTML that
// crawlers read instead of arriving only after the browser's fetch.

export const JOBS_PER_PAGE = 50;
const DEFAULT_START_DATE = { year: 2023, month: 12, day: 31 };

function parseDateParam(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function startOfDay({ year, month, day }: { year: number; month: number; day: number }) {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function endOfDay({ year, month, day }: { year: number; month: number; day: number }) {
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export async function searchJobs(searchParams: URLSearchParams) {
  // Extract parameters
  const page = parseInt(searchParams.get("page") || "1");
  const rolesParam = searchParams.get("roles");
  const regionsParam = searchParams.get("regions");
  const seniorityParam = searchParams.get("seniority");
  const searchByTitle = searchParams.get("search");
  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");

  // Parse and split parameters into arrays
  const roles = rolesParam ? rolesParam.split("_") : undefined;
  const regions = regionsParam ? regionsParam.split("_") : undefined;
  const seniority = seniorityParam ? seniorityParam.split("_") : undefined;
  const parsedDateFrom = parseDateParam(dateFromParam);
  const parsedDateTo = parseDateParam(dateToParam);
  const dateFrom = parsedDateFrom ?? DEFAULT_START_DATE;
  const dateTo = parsedDateTo ?? {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  };

  const skipAmount = JOBS_PER_PAGE * (page - 1);

  // Construct dynamic filter object
  const filters: any = {};
  if (roles) filters.category = { in: roles };
  if (regions) filters.region = { hasSome: regions };
  if (seniority) filters.seniority = { in: seniority };
  filters.updatedAt = {
    gte: startOfDay(dateFrom),
    lte: endOfDay(dateTo),
  };
  if (searchByTitle) {
    filters.title = { contains: searchByTitle, mode: "insensitive" };
  }

  // Execute query using Prisma's filtering and pagination
  const [jobs, jobsCount] = await Promise.all([
    prisma.job.findMany({
      where: filters,
      orderBy: {
        createdAt: "desc",
      },
      take: JOBS_PER_PAGE,
      skip: skipAmount,
      select: {
        slug: true,
        id: true,
        title: true,
        isActive: true,
        applicationUrl: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            name: true,
            logo: true,
            slug: true,
          },
        },
        category: true,
        region: true,
        seniority: true,
      },
    }),
    prisma.job.count({ where: filters }),
  ]);

  return { data: jobs, count: jobsCount };
}
