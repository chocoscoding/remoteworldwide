import { BlogListWithAuthor } from "@/types/main";
import React from "react";
import AllBlogsClient from "./Client";
import { revalidatePath } from "next/cache";

const getInitialBlogs = async (): Promise<{ data: BlogListWithAuthor[]; count: number }> => {
  try {
    const response = await fetch(process.env.NEXT_PUBLIC_URL + "/api/blog?page=1", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Failed to fetch companies");
    }
    const companies = await response.json();
    return companies;
  } catch (error) {
    console.error("Error fetching companies:", error);
    return { data: [], count: 0 };
  }
};
const Page = async () => {
  revalidatePath("/");
  const BLOGS = await getInitialBlogs();
  return <AllBlogsClient initialData={BLOGS.data} initialCount={BLOGS.count} />;
};

export default Page;
