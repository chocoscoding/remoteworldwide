"use client";

import BlogModal from "@/app/components/main/BlogModal";
import PaginationControl from "@/app/components/main/PaginationControl";
import { BlogListWithAuthor } from "@/types/main";
import { LoaderCircle } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

const BlogPage = () => {
  const blogsPerPage = 30;
  const [totalBlogs, setTotalBlogs] = useState(0);
  const totalPages = useMemo(() => Math.ceil(totalBlogs / blogsPerPage), [totalBlogs]);
  const [blogs, setBlogs] = useState<BlogListWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage((prevPage) => prevPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  const getBlogs = async (page: number): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/blog?page=${page}`);
      if (!response.ok) {
        throw new Error("Failed to fetch blogs");
      }
      const blogs = await response.json();

      setBlogs(blogs.data);
      setTotalBlogs(blogs.count);
    } catch (error) {
      console.error("Error fetching blogs:", error);
      setBlogs([]);
      setTotalBlogs(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchBlogs = async () => {
      return await getBlogs(currentPage);
    };
    fetchBlogs();
  }, [currentPage]);

  const startBlogIndex = (currentPage - 1) * blogsPerPage;
  const endBlogIndex = startBlogIndex + blogsPerPage;

  return (
    <main>
      <section className="bg-white flex flex-col items-center justify-center h-[30vh] w-full">
        <h1 className="font-extrabold text-primary text-[4rem]">Blogs</h1>
        <h1 className="font-medium text-neutral-500 text-[1rem]">Get the latest information and news about the job market</h1>
      </section>
      <section className="p-2 w-full max-w-[1400px] m-auto mt-10">
        {isLoading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center">
            <LoaderCircle className="w-[10vw] h-[10vh] animate-spin" />
            <p className="text-xl">Loading...</p>
          </div>
        ) : null}
        {blogs.length === 0 && (
          <div className="h-[60vh] grid place-items-center">
            <div className="text-center text-gray-500">No blogs found.</div>
          </div>
        )}
        {isLoading ? null : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
          md:gap-[42px] gap-8
          ">
            {blogs.map((blog, index) => (
              <div key={index}>
                <BlogModal blog={blog} />
              </div>
            ))}
          </div>
        )}
        {/* pagination */}
        <PaginationControl
          handlePrevious={handlePrevious}
          handleNext={handleNext}
          currentPage={currentPage}
          totalPages={totalPages}
          dataTotal={totalBlogs}
          startIndex={startBlogIndex}
          endIndex={endBlogIndex}
        />
      </section>
    </main>
  );
};

export default BlogPage;
