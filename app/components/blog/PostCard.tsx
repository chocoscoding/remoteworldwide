import type { FC } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { categoryBySlug } from "@/app/lib/blog/categories";
import AuthorStack, { formatAuthorNames, type StackAuthor } from "./AuthorStack";

export interface PostCardData {
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  category: string;
  createdAt: Date | string;
  publishedAt?: Date | string | null;
  author: StackAuthor;
  authors?: StackAuthor[];
}

export function formatPostDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const postAuthors = (post: Pick<PostCardData, "author" | "authors">): StackAuthor[] => (post.authors?.length ? post.authors : [post.author]);

const PostCard: FC<{ post: PostCardData; variant?: "default" | "compact" | "feature"; className?: string }> = ({ post, variant = "default", className }) => {
  const category = categoryBySlug(post.category);
  const date = formatPostDate(post.publishedAt ?? post.createdAt);
  const href = `/blogs/${post.slug}`;
  const authors = postAuthors(post);

  if (variant === "compact") {
    return (
      <Link href={href} className={cn("group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/60", className)}>
        <span className="relative h-14 w-14 flex-none overflow-hidden rounded-lg border-2 border-primary bg-white">
          <Image src={post.coverImage} alt="" fill sizes="56px" className="object-cover" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-primary/55">{category?.name ?? "Blog"}</span>
          <span className="line-clamp-2 text-sm font-bold leading-snug text-primary group-hover:underline">{post.title}</span>
        </span>
      </Link>
    );
  }

  if (variant === "feature") {
    return (
      <article className={cn("group overflow-hidden rounded-[24px] border-2 border-primary bg-white shadow-[6px_6px_0_0_#222325] md:grid md:grid-cols-2", className)}>
        <Link href={href} className="relative block aspect-[3/2] md:aspect-auto md:min-h-[320px]">
          <Image src={post.coverImage} alt={post.title} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" priority />
        </Link>
        <div className="flex flex-col justify-center p-6 md:p-9">
          <span className="w-fit rounded-full bg-secondary px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-primary">{category?.name ?? "Blog"}</span>
          <h3 className="mt-3 text-2xl font-extrabold leading-tight text-primary md:text-3xl">
            <Link href={href} className="hover:underline">
              {post.title}
            </Link>
          </h3>
          <p className="mt-3 line-clamp-3 text-base text-primary/70">{post.description}</p>
          <AuthorStack authors={authors} size="sm" meta={date} link={false} className="mt-5" />
        </div>
      </article>
    );
  }

  return (
    <article className={cn("group flex h-full flex-col", className)}>
      <Link href={href} className="relative block aspect-[3/2] overflow-hidden rounded-[20px] border-2 border-primary bg-white">
        <Image src={post.coverImage} alt={post.title} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <span className="w-fit rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-primary">{category?.name ?? "Blog"}</span>
        <h3 className="mt-2.5 text-xl font-extrabold leading-snug text-primary">
          <Link href={href} className="group-hover:underline">
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-primary/65">{post.description}</p>
        <p className="mt-auto flex items-center gap-2 pt-4 text-xs text-primary/55">
          <span className="flex items-center" aria-hidden>
            {authors.slice(0, 3).map((a, i) => (
              <span key={a.slug} className={cn("relative h-5 w-5 overflow-hidden rounded-full border border-primary/30 bg-white", i > 0 && "-ml-1.5")} style={{ zIndex: 3 - i }}>
                <Image src={a.profileImage} alt="" fill sizes="20px" className="object-cover" />
              </span>
            ))}
          </span>
          <span className="truncate font-semibold text-primary/80">{formatAuthorNames(authors.map((a) => a.name))}</span>
          <span aria-hidden>·</span>
          <span className="flex-none">{date}</span>
        </p>
      </div>
    </article>
  );
};

export default PostCard;
