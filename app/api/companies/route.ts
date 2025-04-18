import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";
const SKIP_AMNT = 50;
//get all companies
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("page");
    const companySearchParam = searchParams.get("find") || "";

    const skipAmount = SKIP_AMNT * (query ? parseInt(query) : 1);
    const [companies, companiesCount] = await Promise.all([
      prisma.company.findMany({
        where: {
          name: {
            contains: companySearchParam,
          },
        },
        orderBy: {
          name: "asc",
        },
        take: SKIP_AMNT,
        skip: skipAmount - SKIP_AMNT,
        select: {
          name: true,
          about: true,
          logo: true,
          _count: true,
        },
      }),
      prisma.company.count(),
    ]);
    return NextResponse.json({ data: companies, count: companiesCount }, { status: 200, statusText: "success" });
  } catch (error: any) {
    return NextResponse.json({ message: "something went wrong" }, { status: 500 });
  }
}
//create one company
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role === "USER") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

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
