"use client";

import { BlogListWithAuthor } from "@/types/main";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FC, useState, useEffect, useMemo } from "react";

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
      <section className="bg-primary flex flex-col items-center justify-center h-[30vh] w-full">
        <h1 className="font-extrabold text-white text-[4rem]">Blogs</h1>
        <h1 className="font-medium text-secondary text-[1rem]">Get the latest information and news about the job market</h1>
      </section>
      <section className="p-2 w-full max-w-[1400px] m-auto mt-10 min-h-screen">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {blogs.map((blog, index) => (
              <div key={index}>
                <BlogModal blog={blog} />
              </div>
            ))}
          </div>
        )}
        <br />
        <hr />
        <div className="mt-5 flex justify-between items-center sm:flex-row gap-2 sm:gap-0 flex-col">
          <p className="flex-shrink-0">
            Showing {startBlogIndex + 1} to {endBlogIndex > totalBlogs ? totalBlogs : endBlogIndex} of {totalBlogs}
          </p>
          <div className="flex gap-4 items-center px-4 py-2 border rounded-full">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className={`${currentPage === 1 ? "text-gray-400" : "text-primary"} flex`}>
              <ChevronLeft />
              Previous
            </button>
            <div className="h-[30px] border-none bg-gray-500 w-[0.5px]"></div>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className={`${currentPage === totalPages ? "text-gray-400" : "text-primary"} flex`}>
              Next
              <ChevronRight />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default BlogPage;

interface BlogModalProps {
  blog: BlogListWithAuthor;
}

const BlogModal: FC<BlogModalProps> = ({ blog }) => {
  return (
    <article className="h-90 col-span-1 m-auto min-h-full cursor-pointer overflow-hidden rounded-md drop-shadow-secondary2-hover border border-primary/10 pb-2 shadow-lg duration-200 hover:translate-y-1 transition-all">
      <Link href={`/blogs/${blog.slug}`} className="block h-full w-full">
        <Image width={1080} height={720} className="max-h-40 w-full object-cover" alt={blog.title} src={blog.coverImage} />
        <div className="w-full bg-white p-4">
          <p className="mb-1 text-xl font-medium text-gray-800 line-clamp-3">{blog.title}</p>
          <p className="text-md font-light text-gray-400 line-clamp-2">{blog.description}</p>
          <Link href={"/authors/" + blog.author.slug} className="text-md font-medium text-indigo-500 mt-1">
            By {blog.author.name}
          </Link>
          <div className="justify-starts mt-2 flex flex-wrap items-center">
            {blog.tags.map((tag, index) => (
              <div key={index} className="mr-2 mt-1 rounded-md bg-primary py-1.5 px-4 text-xs text-white border border-primary">
                #{tag}
              </div>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
};
