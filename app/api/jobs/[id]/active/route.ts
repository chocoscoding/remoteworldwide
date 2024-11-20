import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

// MAKE JOB ACTIVE/ INACTIVE
export async function PUT(req: NextRequest) {
  try {
    const { id } = req.nextUrl.searchParams;
    if (!id) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 });
    }

    const updatedJob = await prisma.job.update({
      where: { id: parseInt(id) },
      data: { isActive: true },
    });

    return NextResponse.json({ data: updatedJob }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
