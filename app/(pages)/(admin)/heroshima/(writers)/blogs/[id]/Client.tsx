"use client";
import { FC, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import { deleteBlog as deleteBlogQuery } from "@/libs/query";

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
      <div className="h-fit block">
        <div className="relative w-full min-h-[30rem] overflow-hidden flex flex-col justify-end">
          <div className="absolute w-full bg-black h-[30rem] z-0"></div>
          <div className="font-extrabold w-full text-center px-10 tracking-tight text-gray-100 lg:text-5xl sm:text-4xl text-2xl z-10 relative">
            {blog.title}
          </div>
          <div className="max-w-3xl mx-auto text-xl leading-8 text-center text-gray-200 sm:mt-1 z-10 relative">{blog.description}</div>
          <div className="flex items-center justify-center mt-1 z-10 relative">
            <Image
              className="rounded-full border-2 border-gray-300 h-10 w-10"
              src={blog.author.profileImage}
              alt={blog.author.name}
              width={50}
              height={50}
            />
            <p className="ml-2 text-gray-300">{blog.author.name}</p>
          </div>
          <div className="sm:flex items-center justify-center space-x-2 text-sm text-gray-300 z-10 relative mt-2 mb-4">
            <p className="">
              <span className="text-slate-200">Created at:</span> {blog.createdAt}
            </p>
            {blog.createdAt !== blog.updatedAt && (
              <>
                <span className="sm:block hidden">•</span>
                <span className="0">Published {new Date(blog.updatedAt).toLocaleDateString("en-GB")}</span>
              </>
            )}
          </div>
          <Image
            className="rounded-lg w-screen border absolute opacity-50 top-0"
            src={blog.coverImage}
            placeholder="blur"
            blurDataURL={blog.coverImage}
            layout="intrinsic"
            width={1080}
            height={720}
            alt={"article cover"}
            priority
          />
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-screen-md space-y-12 px-4 py-10 text-lg tracking-wide text-gray-700">
        <div dangerouslySetInnerHTML={{ __html: blog.content }} />
      </div>

      <div className="flex gap-4 items-center mt-4 justify-center">
        <Link
          href={`/heroshima/blogs/${blog.slug}/edit`}
          className="bg-blue-500 drop-shadow-secondary2-hover flex items-center transition-all text-white text-base border-2 border-primary font-bold rounded-sm p-3 hover:rounded-md">
          Edit blog
        </Link>
        <button
          onClick={deleteBlog}
          disabled={loading}
          className="bg-red-500 drop-shadow-secondary2-hover flex items-center transition-all text-white text-base border-2 border-primary font-bold rounded-sm p-3 hover:rounded-md">
          {loading ? "Deleting..." : "Delete blog"}
        </button>
      </div>
      <br />
    </div>
  );
};

export default BlogPage;
