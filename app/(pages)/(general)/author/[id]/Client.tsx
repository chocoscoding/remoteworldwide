"use client";
import { FC } from "react";
import Link from "next/link";
import { AuthorWithBlog } from "@/types/main";
import Image from "next/image";

const AuthorDetailsPage: FC<{ data: AuthorWithBlog }> = ({ data }) => {
  const { blogs, ...authorsInfo } = data;

  return (
    <div className="w-full h-screen overflow-y-scroll p-2.5">
      <div className="flex items-center gap-4 mb-6">
        <Image
          width={400}
          height={400}
          src={authorsInfo.profileImage}
          alt={authorsInfo.name}
          className="w-40 h-40 border-2 object-cover rounded-full"
        />
        <div>
          <h1 className="text-2xl font-bold">{authorsInfo.name}</h1>
          <p className="text-gray-600">{authorsInfo.about}</p>
          <div className="flex gap-2 mt-2">
            <Link
              href={authorsInfo.website || "#"}
              target={authorsInfo.website ? "_blank" : undefined}
              className={`${authorsInfo.website ? "text-green-500 underline" : "text-gray-400"}`}>
              Website
            </Link>
            <Link
              href={authorsInfo.twitter || "#"}
              target={authorsInfo.twitter ? "_blank" : undefined}
              className={`${authorsInfo.twitter ? "text-green-500 underline" : "text-gray-400"}`}>
              Twitter
            </Link>
            <Link
              href={authorsInfo.linkedin || "#"}
              target={authorsInfo.linkedin ? "_blank" : undefined}
              className={`${authorsInfo.linkedin ? "text-green-500 underline" : "text-gray-400"}`}>
              LinkedIn
            </Link>
            <Link
              href={authorsInfo.instagram || "#"}
              target={authorsInfo.instagram ? "_blank" : undefined}
              className={`${authorsInfo.instagram ? "text-green-500 underline" : "text-gray-400"}`}>
              Instagram
            </Link>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Blogs by {authorsInfo.name}</h2>
      <div className="space-y-4">
        {blogs.length < 1 ? <p className="font-bold text-center my-6 text-xl">No blog yet</p> : null}
        {blogs.map((blog, index) => (
          <div key={index} className="p-4 border border-gray-300 rounded-md shadow-sm">
            <h3 className="text-lg font-bold">{blog.title}</h3>
            <p className="text-gray-600">{blog.description}</p>
            <Link href={`/blogs/${blog.slug}`} className="text-green-500 underline">
              Read More
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};
export default AuthorDetailsPage;
