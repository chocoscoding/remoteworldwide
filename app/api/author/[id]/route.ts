import { NextResponse } from "next/server";
import { prisma } from "@/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const authorSlug = params.id;
    if (!authorSlug) {
      return NextResponse.json({ message: "Author ID is required" }, { status: 400 });
    }
    const author = await prisma.author.findUnique({
      where: {
        slug: authorSlug,
      },
      include: {
        blogs: {
          select: {
            title: true,
            createdAt: true,
            slug: true,
            description: true,
          },
        },
        _count: {
          select: {
            blogs: true,
          },
        },
      },
    });
    if (author) {
      return NextResponse.json({ data: author }, { status: 200 });
    } else {
      return NextResponse.json({ message: "Author not found" }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
