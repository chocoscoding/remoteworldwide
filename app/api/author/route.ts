import { prisma } from "@/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const authors = await prisma.author.findMany({
      select: {
        name: true,
        slug: true,
        id: true,
        profileImage: true,
        about: true,
        _count: {
          select: {
            blogs: true,
          },
        },
      },
    });
    return NextResponse.json({ data: authors }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
