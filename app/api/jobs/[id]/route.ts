import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET ONE JOB
export async function GET(req: NextRequest) {
  try {
    const { id } = req.nextUrl.searchParams;
    if (!id) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id: parseInt(id) },
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
    });

    if (!job) {
      return NextResponse.json({ message: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ data: job }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

// EDIT JOB
export async function PUT(req: NextRequest) {
  try {
    const { id } = req.nextUrl.searchParams;
    if (!id) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 });
    }

    const { title, description, isActive, companyId, applicationUrl, category, region, jobType, seniority } = await req.json();

    const updatedJob = await prisma.job.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        isActive,
        companyId,
        applicationUrl,
        category,
        region,
        jobType,
        seniority,
      },
    });

    return NextResponse.json({ data: updatedJob }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

// DELETE JOB
export async function DELETE(req: NextRequest) {
  try {
    const { id } = req.nextUrl.searchParams;
    if (!id) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 });
    }

    await prisma.job.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Job deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
