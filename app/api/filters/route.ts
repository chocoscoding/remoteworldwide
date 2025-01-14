import { prisma } from "@/prisma"; // Adjust import path accordingly
import { NextResponse } from "next/server";
export const revalidate = 0;
export async function GET() {
  try {
    const [job_type, category, seniority, region] = await Promise.all([
      prisma.jobType
        .findMany({
          select: {
            id: true,
            name: true,
          },
        })
        .then((results) => results.map(({ id, name }) => ({ value: id, label: name }))),
      prisma.category
        .findMany({
          select: {
            id: true,
            name: true,
          },
        })
        .then((results) => results.map(({ id, name }) => ({ value: id, label: name }))),
      prisma.seniority
        .findMany({
          select: {
            id: true,
            name: true,
          },
        })
        .then((results) => results.map(({ id, name }) => ({ value: id, label: name }))),
      prisma.region
        .findMany({
          select: {
            id: true,
            name: true,
          },
        })
        .then((results) => results.map(({ id, name }) => ({ value: id, label: name }))),
    ]);

    // Combine all results
    const combinedResults = {
      job_type,
      category,
      seniority,
      region,
    };

    return NextResponse.json(
      { data: combinedResults },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json("Server error", { status: 500 });
  }
}
