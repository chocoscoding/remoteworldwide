import { NextResponse } from "next/server";
import { prisma } from "@/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const blogSlug = params.id;
  try {
    const blog = await prisma.blog.findUnique({
      where: {
        slug: blogSlug,
      },
      include: {
        author: {
          select: {
            name: true,
            profileImage: true,
            slug: true,
            about: true,
            instagram: true,
            twitter: true,
            linkedin: true,
            website: true,
          },
        },
      },
    });
    if (blog) {
      return NextResponse.json({ data: blog }, { status: 200 });
    } else {
      return NextResponse.json({ message: "Blog not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
