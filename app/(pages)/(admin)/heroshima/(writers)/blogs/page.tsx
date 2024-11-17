"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const blogsPerPage = 9; // Number of blogs per page

const dummyBlogs = Array(50).fill({
  title: "Sample Blog Title",
  author: "Author Name",
  date: "2023-10-01",
  excerpt: "This is a sample blog excerpt...",
  imageUrl: "/path/to/sample-image.jpg", // Replace with actual image URL
  link: "/heroshima/blogs/sample-blog", // Replace with actual blog link
});

export default function AllBlogs() {
  const totalBlogs = dummyBlogs.length;
  const totalPages = Math.ceil(totalBlogs / blogsPerPage);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Handlers for pagination buttons
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

  // Display range for blogs on the current page
  const startBlogIndex = (currentPage - 1) * blogsPerPage;
  const endBlogIndex = startBlogIndex + blogsPerPage;
  const currentBlogs = dummyBlogs.slice(startBlogIndex, endBlogIndex);

  return (
    <div className="p-4 w-full max-w-[1400px] m-auto mt-10">
      <h1 className="text-2xl font-bold mb-4">All Blogs</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentBlogs.map((blog, index) => (
          <BlogTile key={index} blog={blog} />
        ))}
      </div>
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50">
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50">
          Next
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

interface BlogTileProps {
  blog: {
    title: string;
    author: string;
    date: string;
    excerpt: string;
    imageUrl: string;
    link: string;
  };
}

function BlogTile({ blog }: BlogTileProps) {
  return (
    <Link href={blog.link} className="p-4 bg-white shadow rounded-lg flex flex-col">
      <div className="w-full">
        <Image src={blog.imageUrl} alt={blog.title} width={200} height={200} className="rounded-lg object-cover" />
      </div>
      <div className="w-full mt-4">
        <h2 className="text-xl font-semibold">{blog.title}</h2>
        <p className="text-gray-600">
          {blog.author} - {blog.date}
        </p>
        <p className="mt-2">{blog.excerpt}</p>
      </div>
    </Link>
  );
}
