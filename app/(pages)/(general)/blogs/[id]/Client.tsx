"use client";
import { FC } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Facebook, Instagram, Twitter, Linkedin, Globe } from "lucide-react";
import "react-quill/dist/quill.bubble.css";
import { usePathname } from "next/navigation";

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
    about: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    website?: string;
  };
  createdAt: string;
  updatedAt: string;
  tags: string[];
  coverImage: string;
}

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

const BlogPage: FC<{ blog: Blog }> = ({ blog }) => {
  const pathname = usePathname();
  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL}${pathname}`;

  return (
    <div className="blog w-full min-h-screen border-t border-gray-200">
      <div className="container max-w-[1400px] mx-auto md:pt-20 pt-10 px-4">
        <div className="blog-content flex justify-between max-lg:flex-col gap-y-10">
          {/* Main Content */}
          <div className="main xl:w-3/4 lg:w-2/3 lg:pr-[15px]">
            <div className="bg-secondary py-1 px-2.5 rounded-full text-sm font-semibold text-black uppercase inline-block">
              {blog.tags[0] || "Blog"}
            </div>
            <h1 className="text-4xl font-bold mt-2">{blog.title}</h1>
            <div className="author flex items-center gap-2 mt-2.5">
              <div className="avatar w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                <Image src={blog.author.profileImage} width={200} height={200} alt="avatar" className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center gap-2 font-medium">
                <div className="text-sm text-gray-600">by {blog.author.name}</div>
                <div className="w-5 h-px bg-gray-400"></div>
                <div className="text-sm text-gray-600">
                  {new Date(blog.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
            <div className="bg-img py-6">
              <Image
                src={blog.coverImage}
                width={5000}
                height={4000}
                alt={blog.title}
                className="w-full object-cover rounded-3xl"
                priority
              />
            </div>

            {/* Blog Content with Custom Quill Styles */}
            <div className="content">
              <ReactQuill value={blog.content} className="rwwQuill" readOnly modules={{ toolbar: false }} theme="bubble" />
            </div>

            {/* Tags and Share */}
            <div className="action flex items-center justify-between flex-wrap gap-5 md:mt-8 mt-5">
              <div className="left flex items-center gap-3 flex-wrap">
                <p className="font-medium">Tag:</p>
                <div className="list flex items-center gap-3 flex-wrap">
                  {blog.tags.map((tag, index) => (
                    <div
                      key={index}
                      className="bg-gray-100 py-1.5 px-4 rounded-full text-xs uppercase cursor-pointer duration-300 hover:bg-black hover:text-white">
                      {tag}
                    </div>
                  ))}
                </div>
              </div>
              <div className="right flex items-center gap-3 flex-wrap">
                <p className="font-medium">Share:</p>
                <div className="list flex items-center gap-3 flex-wrap">
                  <Link
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    className="bg-gray-100 w-10 h-10 flex items-center justify-center rounded-full duration-300 hover:bg-black hover:text-white">
                    <Facebook className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(blog.title)}`}
                    target="_blank"
                    className="bg-gray-100 w-10 h-10 flex items-center justify-center rounded-full duration-300 hover:bg-black hover:text-white">
                    <Twitter className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    className="bg-gray-100 w-10 h-10 flex items-center justify-center rounded-full duration-300 hover:bg-black hover:text-white">
                    <Linkedin className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="right xl:w-1/4 lg:w-1/3 lg:pl-[25px]">
            <div className="about-author">
              <div className="heading flex gap-5">
                <div className="avatar w-[100px] h-[100px] rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    src={blog.author.profileImage}
                    width={500}
                    height={500}
                    alt="avatar"
                    priority={true}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-600 uppercase tracking-wider">Author</div>
                  <Link href={`/author/${blog.author.slug}`} className="text-xl font-semibold mt-1 hover:underline block">
                    {blog.author.name}
                  </Link>
                </div>
              </div>
              <div className="text-gray-600 mt-5">{blog.author.about}</div>
              <div className="list-social mt-4 flex items-center gap-4 flex-wrap">
                {blog.author.website && (
                  <Link href={blog.author.website} target="_blank" className="text-gray-600 hover:text-black transition-colors">
                    <Globe className="w-5 h-5" />
                  </Link>
                )}
                {blog.author.instagram && (
                  <Link href={blog.author.instagram} target="_blank" className="text-gray-600 hover:text-black transition-colors">
                    <Instagram className="w-5 h-5" />
                  </Link>
                )}
                {blog.author.twitter && (
                  <Link href={blog.author.twitter} target="_blank" className="text-gray-600 hover:text-black transition-colors">
                    <Twitter className="w-5 h-5" />
                  </Link>
                )}
                {blog.author.linkedin && (
                  <Link href={blog.author.linkedin} target="_blank" className="text-gray-600 hover:text-black transition-colors">
                    <Linkedin className="w-5 h-5" />
                  </Link>
                )}
              </div>
            </div>

            <div className="md:mt-10 mt-6 bg-white border shadow-md p-3.5 rounded-[20px]">
              <div className="text-center text-xl font-semibold">Subscribe For Daily Newsletter</div>
              <form className="mt-5">
                <input
                  className="text-center h-[44px] w-full px-4 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                  type="email"
                  placeholder="Your email address"
                />
                <button
                  type="submit"
                  className="bg-black text-white w-full h-[44px] rounded-md mt-2 font-semibold shadow-[5px_5px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073] transition-all">
                  Sign Up
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="lg:pb-20 md:pb-14 pb-10"></div>
    </div>
  );
};

export default BlogPage;
