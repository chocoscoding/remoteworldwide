import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET ONE JOB
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const jobSlug = (await params).id;

    if (!jobSlug) {
      return NextResponse.json({ message: "Job slug is required" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { slug: jobSlug },
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
            slug: true,
          },
        },
        category: true,
        region: true,
        seniority: true,
      },
    });

    if (!job) {
      return NextResponse.json({ message: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ data: job }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

// EDIT JOB
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role === "USER") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = (await params).id;
    if (!id) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 });
    }

    const { title, description, isActive, companyId, applicationUrl, category, region, seniority } = await req.json();
    const normalizedRegion = Array.isArray(region) ? region : region ? [region] : [];

    const updatedJob = await prisma.job.update({
      where: { id: id },
      data: {
        title,
        description,
        isActive,
        companyId,
        applicationUrl,
        category,
        region: normalizedRegion,
        seniority,
      },
    });

    return NextResponse.json({ data: updatedJob }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

// DELETE JOB
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role === "USER") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = (await params).id;
    if (!id) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 });
    }

    await prisma.job.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: "Job deleted successfully" }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
