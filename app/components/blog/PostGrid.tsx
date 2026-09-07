import type { FC } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import PostCard, { type PostCardData } from "./PostCard";

const PostGrid: FC<{ posts: PostCardData[] }> = ({ posts }) => (
  <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
    {posts.map((p) => (
      <PostCard key={p.slug} post={p} />
    ))}
  </div>
);

const PRESS = "transition-[transform,box-shadow] duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";
const PAGE_LINK = cn("inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-semibold text-primary active:bg-primary/10", PRESS);
const PAGE_ACTIVE = "inline-flex h-9 min-w-9 items-center justify-center rounded-md border-2 border-primary bg-white px-2 text-sm font-bold text-primary shadow-[3px_3px_0_0_#222325]";
const EDGE_LINK = cn("inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-sm font-semibold text-primary active:bg-primary/10", PRESS);
const EDGE_DISABLED = "inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-sm font-semibold text-primary/35";

type Item = number | "gap";

function pageItems(page: number, total: number): Item[] {
  const keep = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const sorted = Array.from(keep).sort((a, b) => a - b);
  return sorted.flatMap<Item>((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? ["gap", n] : [n]));
}

export const BlogPagination: FC<{ page: number; totalPages: number; hrefFor: (page: number) => string }> = ({ page, totalPages, hrefFor }) => {
  const total = Math.max(1, totalPages);
  return (
    <nav aria-label="Pagination" className="mt-12">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className={EDGE_LINK}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          ) : (
            <span aria-disabled className={EDGE_DISABLED}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </span>
          )}
        </li>
        {pageItems(page, total).map((item, i) => (
          <li key={item === "gap" ? `gap-${i}` : item}>
            {item === "gap" ? (
              <span aria-hidden className="flex h-9 w-9 items-center justify-center text-primary/60">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            ) : item === page ? (
              <span aria-current="page" className={PAGE_ACTIVE}>
                {item}
              </span>
            ) : (
              <Link href={hrefFor(item)} className={PAGE_LINK}>
                {item}
              </Link>
            )}
          </li>
        ))}
        <li>
          {page < total ? (
            <Link href={hrefFor(page + 1)} rel="next" className={EDGE_LINK}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span aria-disabled className={EDGE_DISABLED}>
              Next
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
};

export default PostGrid;
