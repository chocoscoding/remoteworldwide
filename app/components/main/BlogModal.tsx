import { BlogListWithAuthor } from "@/types/main";
import Image from "next/image";
import Link from "next/link";
import { FC } from "react";

interface BlogModalProps {
  blog: BlogListWithAuthor;
}

const BlogModal: FC<BlogModalProps> = ({ blog }) => {
  return (
    <article className="blog-item h-full cursor-pointer">
      <Link href={`/blogs/${blog.slug}`} className="blog-main h-full block">
        <div className="blog-thumb rounded-[20px] overflow-hidden aspect-[3/2]">
          <Image
            loading="eager"
            width={2000}
            height={1500}
            className="w-full h-full object-cover duration-500 hover:scale-105 transition-transform"
            alt={blog.title}
            src={blog.coverImage}
          />
        </div>
        <div className="blog-infor mt-2">
          {/* tags */}
          <div className="flex flex-wrap items-center gap-2">
            {blog.tags.slice(0, 3).map((tag, index) => (
              <div
                key={index}
                className="blog-tag bg-secondary2 py-1.5 px-2.5 rounded-full text-xs font-bold text-black uppercase inline-block">
                {tag}
              </div>
            ))}
          </div>
          {/* title */}
          <div className="blog-title text-xl font-semibold text-gray-800 mt-3 duration-300 hover:underline line-clamp-2">{blog.title}</div>
          {/* author info */}
          <div className="flex items-center gap-2 mt-2 font-medium">
            <div className="blog-author text-sm text-gray-600">by {blog.author.name}</div>
            <span className="w-[20px] h-[1px] bg-black"></span>
            <div className="blog-date text-sm text-gray-600">
              {new Date(blog.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
};

export default BlogModal;

/*

                <div
                    className="blog-item style-one h-full cursor-pointer"
                    onClick={() => handleBlogClick(data.id)}
                >
                    <div className="blog-main h-full block">
                        <div className="blog-thumb rounded-[20px] overflow-hidden">
                            <Image
                                src={data.thumbImg}
                                width={2000}
                                height={1500}
                                alt='blog-img'
                                className='w-full duration-500'
                            />
                        </div>
                        <div className="blog-infor mt-7">
                            <div className="blog-tag bg-green py-1 px-2.5 rounded-full text-button-uppercase inline-block">{data.tag}</div>
                            <div className="heading6 blog-title mt-3 duration-300">{data.title}</div>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="blog-author caption1 text-secondary">by {data.author}</div>
                                <span className='w-[20px] h-[1px] bg-black'></span>
                                <div className="blog-date caption1 text-secondary">{data.date}</div>
                            </div>
                        </div>
                    </div>
                </div>


// blog item class
.blog-item {
    &:hover {
        .blog-thumb img {
            transform: translateZ(0) scale(1.07);
        }

        .blog-title {
            text-decoration: underline;
        }
    }
}

.blog {
    &.default {
        .list-blog {
            .blog-item {
                .blog-thumb {
                    aspect-ratio: 3/2;

                    img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                }
            }
        }
    }
}

// list-tags
.list-tags {
    .tags {
        &.active {
            background-color: var(--black);
            color: var(--white);
        }
    }
}
                
              */
