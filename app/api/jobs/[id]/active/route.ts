import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

// MAKE JOB ACTIVE/ INACTIVE
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role === "USER") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = (await params).id;
    if (!id) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 });
    }

    const updatedJob = await prisma.job.update({
      where: { id },
      data: { isActive: true },
    });

    return NextResponse.json({ data: updatedJob }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
