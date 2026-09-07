import { BlogListWithAuthor } from "@/types/main";
import React from "react";
import { backend } from "@/app/lib/backend";
import AllBlogsClient from "./Client";

const getInitialBlogs = () => backend<{ data: BlogListWithAuthor[]; count: number }>("/blog/admin/posts?page=1", { session: true });
const Page = async () => {
  const BLOGS = await getInitialBlogs();
  return <AllBlogsClient initialData={BLOGS.data} initialCount={BLOGS.count} />;
};

export default Page;
