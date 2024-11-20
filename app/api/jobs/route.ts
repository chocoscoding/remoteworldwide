import { prisma } from "@/prisma";
import { hexoid } from "hexoid";
import { NextRequest, NextResponse } from "next/server";
const SKIP_AMNT = 50;

function createSlug(input) {
  const timestamp = Date.now();
  return (
    input
      .replace(/[*+~.()'"!:@]/g, "") // Remove specified special characters
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") +
    `${hexoid(36)}` +
    `${timestamp}`
  );
}

// GET ALL JOBS
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("page");

    const skipAmount = SKIP_AMNT * (query ? parseInt(query) : 1);
    const [jobs, jobsCount] = await Promise.all([
      prisma.job.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: SKIP_AMNT,
        skip: skipAmount - SKIP_AMNT,
        select: {
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
      prisma.job.count(),
    ]);
    return NextResponse.json({ data: jobs, count: jobsCount }, { status: 200, statusText: "success" });
  } catch (error: any) {
    return NextResponse.json({ message: "something went wrong" }, { status: 404 });
  }
}

// CREATE JOB
export async function POST(req: NextRequest) {
  try {
    const { title, description, companyId, applicationUrl, category, region, jobType, seniority } = await req.json();
    const BODY_VALUES = { title, description, companyId, applicationUrl, category, region, jobType, seniority };

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
