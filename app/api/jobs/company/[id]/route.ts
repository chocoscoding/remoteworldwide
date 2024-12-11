import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";
const SKIP_AMNT = 50;
// GET ALL JOBS
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const companyId = (await params).id;
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("page");
    if (!companyId) {
      return NextResponse.json({ message: "company ID is required" }, { status: 400 });
    }
    const skipAmount = SKIP_AMNT * ((query ? parseInt(query) : 1) - 1);
    const [jobs, jobsCount] = await Promise.all([
      prisma.job.findMany({
        where: {
          companyId,
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: SKIP_AMNT,
        skip: skipAmount,
        select: {
          title: true,
          slug: true,
          isActive: true,
          createdAt: true,
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
      prisma.job.count({
        where: {
          companyId,
        },
      }),
    ]);
    return NextResponse.json({ data: jobs, count: jobsCount }, { status: 200, statusText: "success" });
  } catch (error: any) {
    return NextResponse.json({ message: "something went wrong" }, { status: 404 });
  }
}
