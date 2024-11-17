import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ filterType: string }> }) {
  const filterParam = (await params).filterType;
  const { name } = await request.json();
  try {
    if (!name) {
      return NextResponse.json({ message: "name not provided" }, { status: 404, statusText: "forbidden" });
    }
    const filters = {
      region: prisma.region.create({
        data: {
          name,
        },
      }),
      jobType: prisma.jobType.create({
        data: {
          name,
        },
      }),
      seniority: prisma.seniority.create({
        data: {
          name,
        },
      }),
      category: prisma.category.create({
        data: {
          name,
        },
      }),
    };
    if (Object.keys(filters).includes(filterParam) === false) {
      return NextResponse.json({}, { status: 404, statusText: "invalid URL" });
    }

    const filterType2 = filterParam as keyof typeof filters;

    const createFilter = await filters[filterType2];
    return NextResponse.json({ filterType2: createFilter }, { status: 202, statusText: "Success" });
  } catch (error: any) {
    if (error.message.includes("Unique constraint failed on the constraint")) {
      return NextResponse.json({ message: name + " aleady exist" }, { status: 404, statusText: "Error" });
    }
    return NextResponse.json({}, { status: 404, statusText: "Error" });
  }
}
