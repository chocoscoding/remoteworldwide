"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

const dummyBlog = {
  title: "Sample Blog Title",
  description: "This is a sample blog description...",
  tags: "sample, blog, example",
  date: "10-10-2024",
  author: {
    value: "john",
    label: "John",
    imageUrl:
      "https://images.unsplash.com/flagged/photo-1570612861542-284f4c12e75f?ixlib=rb-1.2.1&amp;ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8cGVyc29ufGVufDB8fDB8fA%3D%3D&amp;auto=format&amp;fit=crop&amp;w=500&amp;q=60",
  },
  content: "<p>This is the blog content...</p>",
  imageUrl:
    "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80", // Replace with actual image URL
};

export default function BlogPage() {
  const { id } = useParams();
  const [blog, setBlog] = useState(dummyBlog);

  useEffect(() => {
    // Fetch blog data based on the ID
    // Replace this with actual data fetching logic
    if (id) {
      setBlog(dummyBlog);
    }
  }, [id]);

  if (!blog) {
    return <p>Loading...</p>;
  }

  return (
    <>
      <main>
        <article>
          <header className="mx-auto max-w-screen-xl pt-8 text-center">
            <p className="text-gray-500">Published {blog.date}</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-5xl">{blog.title}</h1>
            <p className="mt-3 text-lg text-gray-700">{blog.description}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Tags">
              {blog.tags.split(",").map((tag, index) => (
                <button key={index} className="rounded-lg bg-gray-100 px-2 py-1 font-medium text-gray-600 hover:bg-gray-200">
                  {tag.trim()}
                </button>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center">
              <Image src={blog.author.imageUrl} alt={blog.author.label} width={50} height={50} className="rounded-full" />
              <p className="ml-2 text-gray-700">{blog.author.label}</p>
            </div>
            <Image
              width={1080}
              height={720}
              className="sm:h-[34rem] mt-10 w-full object-contain"
              src={blog.imageUrl}
              alt="Featured Image"
            />
          </header>

          <div className="mx-auto mt-10 max-w-screen-md space-y-12 px-4 py-10 font-serif text-lg tracking-wide text-gray-700">
            <div dangerouslySetInnerHTML={{ __html: blog.content }} />
          </div>
        </article>
      </main>
    </>
  );
}
