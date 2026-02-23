import NotFound from "@/app/components/NotFound";
import { AuthorWithBlog } from "@/types/main";
import React from "react";
import AuthorDetailsPage from "./Client";

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
  } catch {
    throw new Error("Failed to fetch author.");
  }
};

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const author = await getOneAuthor((await params).id);
  if (!author) return <NotFound title="Author" link="/heroshima/authors/create" buttonType="link" />;
  return <AuthorDetailsPage data={author} />;
};

export default Page;
