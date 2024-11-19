import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

//get one company
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const companyId = (await params).id;
    const oneCompany = await prisma.company.findUniqueOrThrow({
      where: {
        id: companyId,
      },
    });

    return NextResponse.json({ data: oneCompany }, { status: 200 });
  } catch (error: any) {
    console.log(error);
    return NextResponse.json({ message: error.message }, { status: 404 });
  }
}
//edit one company
export async function PUT() {}
//delete one company
export async function DELETE() {}
