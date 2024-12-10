import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET ALL JOBS from last 24hrs
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    const filters: any = {};

    // Add filter for jobs created within the last 24 hours
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    filters.createdAt = { gte: last24Hours };

    // Execute query using Prisma's filtering and pagination
    const [jobs, jobsCount] = await Promise.all([
      prisma.job.findMany({
        where: filters,
        orderBy: {
          createdAt: "desc",
        },
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
