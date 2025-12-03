import NotFound from "@/app/components/NotFound";
import { AuthorWithBlog } from "@/types/main";
import React from "react";
import AuthorDetailsPage from "./Client";
import { Metadata } from "next";

const getOneAuthor = async (id: string): Promise<AuthorWithBlog | null> => {
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/author/" + id, { cache: "no-cache" });
    const data: Promise<{ data: AuthorWithBlog; message: string }> = await res.json();
    if (!res.ok) {
      if ((await data).message.includes("Author not found")) {
        return null;
      } else {
        throw new Error((await data).message);
      }
    }
    return (await data).data;
  } catch (error) {
    throw new Error("Failed to fetch author.");
  }
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const authorId = (await params).id;
  const author = await getOneAuthor(authorId);

  if (!author) {
    return {
      title: "Author Not Found",
      description: "The requested author could not be found.",
    };
  }

  const blogCount = author._count?.blogs || 0;
  const title = `${author.name} - Author Profile | Remote Worldwide`;
  const description = author.about
    ? `${author.about.substring(0, 155)}...`
    : `Read articles by ${author.name}. ${blogCount} ${blogCount === 1 ? "post" : "posts"} about remote work and career development.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/author/${authorId}`,
      siteName: "Remote Worldwide",
      images: author.profileImage
        ? [
            {
              url: author.profileImage,
              width: 1200,
              height: 630,
              alt: `${author.name} - Author Profile`,
            },
          ]
        : [],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: author.profileImage ? [author.profileImage] : [],
    },
  };
}

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const author = await getOneAuthor((await params).id);
  if (!author) return <NotFound title="Author" link="/heroshima/authors/create" buttonType="link" />;
  return <AuthorDetailsPage data={author} />;
};

export default Page;
