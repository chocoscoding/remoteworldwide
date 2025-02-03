import { BlogListWithAuthor } from "@/types/main";
import Image from "next/image";
import Link from "next/link";
import { FC } from "react";

interface BlogModalProps {
  blog: BlogListWithAuthor;
}

const BlogModal: FC<BlogModalProps> = ({ blog }) => {
  return (
    <article className="h-90 col-span-1 m-auto min-h-full cursor-pointer overflow-hidden rounded-md drop-shadow-secondary2-hover border border-primary/10 pb-2 shadow-lg duration-200 hover:translate-y-1 transition-all">
      <Link href={`/blogs/${blog.slug}`} className="block h-full w-full">
        <Image loading="eager" width={1080} height={720} className="max-h-40 w-full object-cover" alt={blog.title} src={blog.coverImage} />
        <div className="w-full bg-white p-4">
          {/* title */}
          <p className="mb-1 text-xl font-medium text-gray-800 line-clamp-3">{blog.title}</p>
          {/* description */}
          <p className="text-md font-light text-gray-400 line-clamp-2">{blog.description}</p>
          {/* link to author */}
          <Link href={"/authors/" + blog.author.slug} className="text-md font-medium text-indigo-500 mt-1">
            By {blog.author.name}
          </Link>
          {/* tags */}
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

export default BlogModal;
