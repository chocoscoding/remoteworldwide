import type { FC } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PostFull } from "@/app/lib/blog/types";
import { formatPostDate, postAuthors } from "@/app/components/blog/PostCard";
import { formatAuthorNames } from "@/app/components/blog/AuthorStack";

export const BlogTile: FC<{ blog: PostFull }> = ({ blog }) => (
  <Link href={`/heroshima/blogs/${blog.slug}`} className="flex h-[400px] flex-col rounded-lg bg-white p-2 shadow">
    <div className="h-[60%] w-full">
      <Image src={blog.coverImage} alt={blog.title} width={1080} height={720} className="aspect-square h-full rounded-lg object-cover" />
    </div>
    <div className="mt-4 w-full">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{blog.title}</h2>
        {blog.status !== "PUBLISHED" && <span className="rounded-full bg-[#fdeae6] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#b23c26]">Draft</span>}
      </div>
      <p className="my-2 line-clamp-2 text-md font-light text-gray-400">{blog.description.substring(0, 200)}</p>
      <p className="text-gray-600">
        {formatAuthorNames(postAuthors(blog).map((a) => a.name))} - {formatPostDate(blog.publishedAt ?? blog.createdAt)}
      </p>
    </div>
  </Link>
);

export const BlogTileSkeleton: FC<{ amount: number }> = ({ amount }) => (
  <>
    {Array.from({ length: amount }).map((_, index) => (
      <div key={index} className="flex animate-pulse flex-col rounded-lg bg-white p-4 shadow">
        <div className="h-48 w-full rounded-lg bg-gray-200" />
        <div className="mt-4 w-full">
          <div className="mb-2 h-6 w-3/4 rounded bg-gray-200" />
          <div className="mb-2 h-4 w-1/2 rounded bg-gray-200" />
          <div className="h-4 w-full rounded bg-gray-200" />
        </div>
      </div>
    ))}
  </>
);
