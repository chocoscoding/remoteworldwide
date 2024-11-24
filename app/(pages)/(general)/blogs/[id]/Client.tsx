"use client";
import { FC } from "react";
import Image from "next/image";
import Link from "next/link";

interface Blog {
  id: string;
  title: string;
  content: string;
  description: string;
  slug: string;
  author: {
    name: string;
    profileImage: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string;
  tags: string[];
  coverImage: string;
}

const BlogPage: FC<{ blog: Blog }> = ({ blog }) => {
  return (
    <div className="w-full min-h-screen">
      <div className="h-fit block">
        <div className="relative w-full h-[14rem] md:h-[20rem] lg:h-[24rem] xl:h-[27rem] overflow-hidden flex flex-col justify-end">
          <div className="absolute w-full bg-black h-full z-0"></div>
          <div className="font-extrabold w-full text-center px-10 tracking-tight text-gray-100 lg:text-5xl sm:text-4xl text-2xl z-10 relative">
            {blog.title}
          </div>
          <div className="max-w-3xl mx-auto text-xl leading-8 text-center text-gray-200 sm:mt-1 z-10 relative">{blog.description}</div>
          <Link href={`/author/${blog.author.slug}`} className="flex items-center justify-center mt-1 z-10 relative">
            <Image
              className="rounded-full border-2 border-gray-300 h-10 w-10"
              src={blog.author.profileImage}
              alt={blog.author.name}
              width={50}
              height={50}
            />
            <p className="ml-2 text-gray-300">{blog.author.name}</p>
          </Link>
          <div className="sm:flex items-center justify-center space-x-2 text-sm text-gray-300 z-10 relative mt-2 mb-4">
            <p className="text-center">
              <span className="text-slate-200">Created at:</span> {blog.createdAt}
            </p>
            {blog.createdAt !== blog.updatedAt && (
              <span className="0">Published {new Date(blog.updatedAt).toLocaleDateString("en-GB")}</span>
            )}
          </div>
          <div className="rounded-lg !w-full !h-full border absolute opacity-50 top-0">
            <div className="w-full h-full relative">
              <Image
                className="!h-full sm:h-auto sm:!w-full object-cover"
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
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-screen-md space-y-12 px-4 py-10 text-lg tracking-wide text-gray-700">
        <div dangerouslySetInnerHTML={{ __html: blog.content }} />
      </div>

      <br />
    </div>
  );
};

export default BlogPage;
