import { requireAdmin } from "@/app/lib/auth/require-admin";
import { prisma } from "@/prisma";
import { hexoid } from "hexoid";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { searchJobs } from "@/app/lib/jobs/searchJobs";

//create a slug for job
function createSlug(input: string) {
  const timestamp = Date.now();
  return (
    input
      .replace(/[*+~.()^'"!#:@&/|{}[\]\\]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") +
    "-" +
    `${hexoid(30)()}` +
    `${timestamp}`
  );
}

// GET ALL JOBS
export async function GET(req: NextRequest) {
  try {
    const jobs = await searchJobs(req.nextUrl.searchParams);

    // Return response
    return NextResponse.json(jobs, { status: 200, statusText: "success" });
  } catch (error: any) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

// CREATE JOB
export async function POST(req: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { title, description, companyId, applicationUrl, category, region, seniority } = await req.json();
    const normalizedRegion = Array.isArray(region) ? region : region ? [region] : [];
    const BODY_VALUES = { title, description, companyId, applicationUrl, category, region: normalizedRegion, seniority, slug: "0" };

    const missingValue = [
      !BODY_VALUES.title && "title",
      !BODY_VALUES.description && "description",
      !BODY_VALUES.companyId && "companyId",
      !BODY_VALUES.applicationUrl && "applicationUrl",
      !BODY_VALUES.category && "category",
      BODY_VALUES.region.length === 0 && "region",
      !BODY_VALUES.seniority && "seniority",
    ].filter(Boolean) as string[];

    const errorMessage = missingValue.length ? `Missing values: ${missingValue.join(", ")}` : null;

    if (errorMessage) {
      return NextResponse.json({ message: errorMessage }, { status: 400, statusText: "Bad Request" });
    }
    BODY_VALUES.slug = createSlug(title);

    const createJob = await prisma.job.create({
      data: { ...BODY_VALUES },
    });
    revalidatePath("/");
    return NextResponse.json({ data: createJob }, { status: 200, statusText: "success" });
  } catch (error: any) {
    return NextResponse.json({ message: "something went wrong" }, { status: 404 });
  }
}
