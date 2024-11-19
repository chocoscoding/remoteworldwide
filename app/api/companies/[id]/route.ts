import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

//get one company
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const companyName = (await params).id;
    const oneCompany = await prisma.company.findUnique({
      where: {
        name: companyName,
      },
    });
    if (!oneCompany) {
      return NextResponse.json({ message: "No company found" }, { status: 404 });
    }

    return NextResponse.json({ data: oneCompany }, { status: 200 });
  } catch (error: any) {
    console.log(error);
    return NextResponse.json({ message: error.message }, { status: 404 });
  }
}
//edit one company
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const companyId = (await params).id;

    const { name, about, logo, website, linkedin, twitter, facebook } = await req.json();
    const BODY_VALUES = { name, about, logo, website, linkedin, twitter, facebook };

    const bodyLength = Object.entries(BODY_VALUES);

    if (bodyLength.length < 1) {
      return NextResponse.json({ message: "Update at least one thing" }, { status: 400, statusText: "Bad Request" });
    }

    const createCompany = await prisma.company.update({
      where: {
        id: companyId,
      },
      data: BODY_VALUES,
    });
    return NextResponse.json({ data: createCompany }, { status: 200, statusText: "success" });
  } catch (error: any) {
    if (error.message.includes("Unique constraint failed on the constraint")) {
      return NextResponse.json({ message: "Company already exist" }, { status: 404 });
    }
    return NextResponse.json({ message: "something went wrong" }, { status: 404 });
  }
}
//delete one company
export async function DELETE() {}
