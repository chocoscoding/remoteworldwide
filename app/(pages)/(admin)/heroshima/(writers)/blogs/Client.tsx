"use client";
import { FC } from "react";
import { BlogListWithAuthor } from "@/types/main";
import blogWithPagination from "@/app/components/main/blogWithPagination";

const fetchJobs = async (page: number): Promise<{ data: BlogListWithAuthor[]; count: number }> => {
  try {
    const response = await fetch(process.env.NEXT_PUBLIC_URL + "/api/blog?page=" + page, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Failed to fetch companies");
    }
    const companies = await response.json();
    return companies;
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};
const AllBlogsClient: FC<{ initialData: BlogListWithAuthor[]; initialCount: number }> = ({ initialCount, initialData }) => {
  const PaginatedBlogs = blogWithPagination(null, fetchJobs, 50, initialData, initialCount);

  return (
    <div className="p-4 w-full max-w-[1400px] m-auto min-h-screen">
      <h1 className="text-2xl font-bold mb-4">All Blogs</h1>

      <PaginatedBlogs />
    </div>
  );
};

export default AllBlogsClient;
