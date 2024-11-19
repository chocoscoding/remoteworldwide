import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

//get all companies
export async function GET() {}
//create one company
export async function POST(req: NextRequest) {
  try {
    const { name, about, logo, website, linkedin, twitter, facebook } = await req.json();
    const REQUIRED_BODY_VALUES = { name, about, logo, website };
    const BODY_VALUES = { name, about, logo, website, linkedin, twitter, facebook };

    const missingValue = Object.entries(REQUIRED_BODY_VALUES).filter(([key, value]) => !value);

    const errorMessage = missingValue.length ? `Missing values: ${missingValue.map(([key]) => key).join(", ")}` : null;

    if (errorMessage) {
      return NextResponse.json({ message: errorMessage }, { status: 400, statusText: "Bad Request" });
    }

    const createCompany = await prisma.company.create({
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
