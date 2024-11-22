// FILE: app/api/blogs/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/prisma";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * PAGE_SIZE;

    const [blogs, totalBlogs] = await Promise.all([
      prisma.blog.findMany({
        skip,
        take: PAGE_SIZE,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          author: {
            select: {
              name: true,
              profileImage: true,
            },
          },
        },
      }),
      prisma.blog.count(),
    ]);

    return NextResponse.json(
      {
        data: blogs,
        count: totalBlogs,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
