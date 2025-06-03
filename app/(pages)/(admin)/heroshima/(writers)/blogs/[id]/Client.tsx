"use client";
import { FC, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import { deleteBlog as deleteBlogQuery } from "@/libs/query";
import dynamic from "next/dynamic";

interface Blog {
  id: string;
  title: string;
  content: string;
  description: string;
  slug: string;
  author: {
    name: string;
    profileImage: string;
  };
  createdAt: string;
  updatedAt: string;
  tags: string[];
  coverImage: string;
}

interface BlogProps {
  blogId: string;
}
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

const BlogPage: FC<{ blog: Blog }> = ({ blog }) => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const deleteBlog = async () => {
    try {
      setLoading(true);
      // Replace with actual delete function
      await deleteBlogQuery(blog.id);

      toast.success("Blog deleted successfully!", {
        position: "bottom-right",
        autoClose: 3500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      router.push("/heroshima/blogs");
    } catch (error: any) {
      toast.error(`Failed to delete blog: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen">
      <div className="relative w-full h-[260px] sm:h-[320px] md:h-[400px] flex items-end justify-center overflow-hidden">
        <Image src={blog.coverImage} alt={blog.title} fill className="object-cover object-center brightness-[.55]" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />
        <div className="relative z-20 w-full max-w-3xl px-4 py-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white drop-shadow-lg mb-4">{blog.title}</h1>
          <p className="text-lg sm:text-xl text-gray-100 font-medium drop-shadow mb-6">{blog.description}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2">
              <Image
                src={blog.author.profileImage}
                alt={blog.author.name}
                width={40}
                height={40}
                className="rounded-full border-2 border-white shadow"
              />
              <span className="text-base font-semibold text-white">{blog.author.name}</span>
            </div>
            <span className="hidden sm:block text-white text-xl">·</span>
            <span className="text-sm text-gray-200 font-light">Published {new Date(blog.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-screen-lg space-y-12 bg-white rounded-md">
        <ReactQuill value={blog.content} readOnly modules={{ toolbar: false }} theme="bubble" className="!text-xl" />
      </div>

      <div className="flex gap-4 items-center mt-4 justify-center">
        <Link
          href={`/heroshima/blogs/${blog.slug}/edit`}
          className="bg-blue-500 drop-shadow-secondary2-hover flex items-center transition-all text-white text-base border-2 border-primary font-bold rounded p-3 hover:rounded-md">
          Edit blog
        </Link>
        <button
          onClick={deleteBlog}
          disabled={loading}
          className="bg-red-500 drop-shadow-secondary2-hover flex items-center transition-all text-white text-base border-2 border-primary font-bold rounded p-3 hover:rounded-md">
          {loading ? "Deleting..." : "Delete blog"}
        </button>
      </div>
      <br />
    </div>
  );
};

export default BlogPage;
