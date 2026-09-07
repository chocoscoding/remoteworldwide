import NotFound from "@/app/components/NotFound";
import React from "react";
import { getAuthorProfile } from "@/app/lib/blog/data";
import AuthorDetailsPage from "./Client";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const author = await getAuthorProfile((await params).id);
  if (!author) return <NotFound title="Author" link="/heroshima/authors/create" buttonType="link" />;
  return <AuthorDetailsPage data={author} />;
};

export default Page;
