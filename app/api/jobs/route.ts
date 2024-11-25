import { prisma } from "@/prisma";
import { hexoid } from "hexoid";
import { NextRequest, NextResponse } from "next/server";
const SKIP_AMNT = 50;

function createSlug(input: string) {
  const timestamp = Date.now();
  return (
    input
      .replace(/[*+~.()'"!:@]/g, "") // Remove specified special characters
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") +
    "-" +
    `${hexoid(36)()}` +
    `${timestamp}`
  );
}

// GET ALL JOBS
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    // Extract parameters
    const page = parseInt(searchParams.get("page") || "1");
    const rolesParam = searchParams.get("roles");
    const regionsParam = searchParams.get("regions");
    const seniorityParam = searchParams.get("seniority");
    const jobTypesParam = searchParams.get("jobTypes");
    const searchByTitle = searchParams.get("search");

    // Parse and split parameters into arrays
    const roles = rolesParam ? rolesParam.split("_") : undefined;
    const regions = regionsParam ? regionsParam.split("_") : undefined;
    const seniority = seniorityParam ? seniorityParam.split("_") : undefined;
    const jobTypes = jobTypesParam ? jobTypesParam.split("_") : undefined;

    // Pagination logic
    const SKIP_AMNT = 10; // Adjust this value as needed
    const skipAmount = SKIP_AMNT * (page - 1);

    // Construct dynamic filter object
    const filters: any = {};
    if (roles) filters.category = { in: roles };
    if (regions) filters.region = { in: regions };
    if (seniority) filters.seniority = { in: seniority };
    if (jobTypes) filters.jobType = { in: jobTypes };
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
        take: SKIP_AMNT,
        skip: skipAmount,
        select: {
          slug:true,
          id: true,
          title: true,
          description: true,
          isActive: true,
          applicationUrl: true,
          createdAt: true,
          updatedAt: true,
          company: {
            select: {
              name: true,
              logo: true,
            },
          },
          category: true,
          region: true,
          jobType: true,
          seniority: true,
        },
      }),
      prisma.job.count({ where: filters }),
    ]);

    // Return response
    return NextResponse.json({ data: jobs, count: jobsCount }, { status: 200, statusText: "success" });
  } catch (error: any) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

// CREATE JOB
export async function POST(req: NextRequest) {
  try {
    const { title, description, companyId, applicationUrl, category, region, jobType, seniority } = await req.json();
    const BODY_VALUES = { title, description, companyId, applicationUrl, category, region, jobType, seniority, slug: "0" };

    const missingValue = Object.entries(BODY_VALUES).filter(([key, value]) => !value);

    const errorMessage = missingValue.length ? `Missing values: ${missingValue.map(([key]) => key).join(", ")}` : null;

    if (errorMessage) {
      return NextResponse.json({ message: errorMessage }, { status: 400, statusText: "Bad Request" });
    }
    BODY_VALUES.slug = createSlug(title);

    const createJob = await prisma.job.create({
      data: BODY_VALUES,
    });
    return NextResponse.json({ data: createJob }, { status: 200, statusText: "success" });
  } catch (error: any) {
    return NextResponse.json({ message: "something went wrong" }, { status: 404 });
  }
}
