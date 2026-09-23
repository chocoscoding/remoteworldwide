import { prisma } from "@/prisma";
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * A constant-time string compare.
 *
 * `timingSafeEqual` THROWS when the two buffers differ in length, so the length is
 * checked first and answered false. That leaks the length of the secret and nothing
 * else — every same-length candidate still takes the same time to reject, which is the
 * part that matters.
 */
function secretMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// GET ALL JOBS from last 24hrs
export async function GET(req: NextRequest) {
  try {
    // `Bearer <secret>` — the exact form Vercel Cron sends, and now the form rwwbot
    // must send too. This used to read `Bearer - ${secret}`, which no cron header could
    // ever match, and which authenticated the literal string "Bearer - undefined"
    // whenever CRON_SECRET was missing. So a missing secret now refuses everything
    // rather than opening the route: an unset secret is a deployment fault, not a
    // caller's, hence 500 rather than 401.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[jobs/bot] CRON_SECRET is not set — refusing every request");
      return new Response("Server misconfigured", { status: 500 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader || !secretMatches(authHeader, `Bearer ${cronSecret}`)) {
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

    // Return response
    return NextResponse.json({ data: jobs, count: jobsCount }, { status: 200, statusText: "success" });
  } catch (error: any) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
