"use client";
import { BlogListWithAuthor, FetchDataFunction_2, WithPaginationProps } from "@/types/main";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import PaginationControl from "./PaginationControl";

// Higher-Order Component to handle pagination with loading state
const blogWithPagination = (
  WrappedComponent: React.ComponentType<WithPaginationProps> | null,
  fetchDataFunction: FetchDataFunction_2<BlogListWithAuthor>,
  blogsPerPage: number = 50,
  initialBlogs: BlogListWithAuthor[] = [],
  initialTotalBlogs: number = 0
) => {
  return function BlogWithPagination(props: any) {
    const [blogs, setBlogs] = useState<BlogListWithAuthor[]>(initialBlogs);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalBlogs, setTotalBlogs] = useState<number>(initialTotalBlogs);
    const [loading, setLoading] = useState<boolean>(false); // Loading state added

    // Fetch jobs when the component mounts or when the currentPage changes
    useEffect(() => {
      const fetchJobs = async () => {
        setLoading(true); // Set loading to true before fetching data
        try {
          const { data: fetchedJobs, count } = await fetchDataFunction(currentPage, blogsPerPage);
          setBlogs(fetchedJobs);
          setTotalBlogs(count);
        } catch (error) {
          console.error("Failed to fetch jobs:", error);
        } finally {
          setLoading(false); // Set loading to false after the fetch completes (success or error)
        }
      };
      if (currentPage > 1) {
        fetchJobs();
      }
    }, [currentPage]);

    // Pagination logic
    const totalPages = Math.ceil(totalBlogs / blogsPerPage);
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

    // Display range for jobs on the current page
    const blogStartIndex = (currentPage - 1) * blogsPerPage;
    const blogEndIndex = blogStartIndex + blogsPerPage;

    return (
      <div>
        {WrappedComponent ? (
          <WrappedComponent
            {...props}
            jobs={blogs}
            currentPage={currentPage}
            totalJobs={totalBlogs}
            totalPages={totalPages}
            startJobIndex={blogStartIndex}
            endJobIndex={blogEndIndex}
            handlePrevious={handlePrevious}
            handleNext={handleNext}
            loading={loading} // Pass loading state to the wrapped component
          />
        ) : (
          <>
            <div className="mb-5 my-10">
              <p className="text-xl mb-2">
                <span className="font-bold text-primary">Blogs</span>{" "}
                <span className="font-extralight text-gray-400 italic text-lg">{`(${totalBlogs})`}</span>
              </p>
              <hr />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4            ">
              {loading ? <BlogTileSkeleton amount={6} /> : blogs.map((blog, index) => <BlogTile key={index} blog={blog} />)}
            </div>
          </>
        )}

        {/* pagination */}
        <PaginationControl
          handlePrevious={handlePrevious}
          handleNext={handleNext}
          currentPage={currentPage}
          totalPages={totalPages}
          dataTotal={totalBlogs}
          startIndex={blogStartIndex}
          endIndex={blogEndIndex}
        />
      </div>
    );
  };
};

export default blogWithPagination;

function BlogTile({ blog }: { blog: BlogListWithAuthor }) {
  return (
    <Link href={`/heroshima/blogs/${blog.slug}`} className="p-2 bg-white shadow rounded-lg flex flex-col h-[400px]">
      <div className="w-full h-[60%]">
        <Image src={blog.coverImage} alt={blog.title} width={1080} height={720} className="rounded-lg object-cover h-full aspect-square" />
      </div>
      <div className="w-full mt-4">
        <h2 className="text-xl font-semibold">{blog.title}</h2>
        <p className="text-md font-light text-gray-400 overflow-ellipsis line-clamp-2 my-2">{blog.description.substring(0, 200)}</p>{" "}
        <p className="text-gray-600">
          {blog.author.name} - {new Date(blog.createdAt).toLocaleDateString("en-GB")}
        </p>
      </div>
    </Link>
  );
}
// Skeleton component for loading state
const BlogTileSkeleton = ({ amount }: { amount: number }) =>
  Array(amount)
    .fill(0)
    .map((_, index) => (
      <div className="p-4 bg-white shadow rounded-lg flex flex-col animate-pulse" key={index}>
        <div className="w-full bg-gray-200 h-48 rounded-lg"></div>
        <div className="w-full mt-4">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    ));
