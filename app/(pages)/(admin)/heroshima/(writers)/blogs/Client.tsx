"use client";

import { useRef, useState, type FC } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import type { PostFull } from "@/app/lib/blog/types";
import type { AdminPostScope } from "@/libs/blog-admin";
import PaginationControl from "@/app/components/main/PaginationControl";
import { BlogTile, BlogTileSkeleton } from "@/app/components/ADMIN/blog/BlogTile";

const PER_PAGE = 50;
const NO_PROFILE = "Create your author profile first";

const SCOPES: { value: AdminPostScope; label: string }[] = [
  { value: "mine", label: "My blogs" },
  { value: "all", label: "All blogs" },
];

async function fetchAdminPosts(page: number, scope: AdminPostScope): Promise<{ data: PostFull[]; count: number }> {
  const res = await fetch(`/api/blog/admin/posts?page=${page}${scope === "mine" ? "&mine=1" : ""}`, { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? "Failed to fetch blogs");
  return body.data;
}

const AllBlogsClient: FC<{ initialRows: PostFull[]; initialCount: number; initialScope: AdminPostScope; hasAuthorProfile: boolean }> = ({
  initialRows,
  initialCount,
  initialScope,
  hasAuthorProfile,
}) => {
  const [view, setView] = useState({ scope: initialScope, page: 1, rows: initialRows, count: initialCount });
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  const load = async (scope: AdminPostScope, page: number) => {
    const id = ++request.current;
    setLoading(true);
    try {
      const { data, count } = await fetchAdminPosts(page, scope);
      if (id === request.current) setView({ scope, page, rows: data, count });
    } catch (error) {
      if (id === request.current) toast.error(error instanceof Error ? error.message : "Failed to fetch blogs");
    } finally {
      if (id === request.current) setLoading(false);
    }
  };

  const changeScope = (scope: AdminPostScope) => {
    if (scope === "mine" && !hasAuthorProfile) {
      toast.error(NO_PROFILE);
      return;
    }
    if (scope !== view.scope) void load(scope, 1);
  };

  const totalPages = Math.max(1, Math.ceil(view.count / PER_PAGE));
  const mine = view.scope === "mine";

  return (
    <div className="m-auto min-h-screen w-full max-w-[1400px] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{mine ? "My blogs" : "All blogs"}</h1>
        <div role="tablist" aria-label="Which blogs" className="inline-flex rounded-md border-2 border-[#222325] bg-white p-0.5">
          {SCOPES.map((s) => {
            const on = view.scope === s.value;
            return (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={on}
                data-scope={s.value}
                title={s.value === "mine" && !hasAuthorProfile ? NO_PROFILE : undefined}
                onClick={() => changeScope(s.value)}
                className={`rounded-[4px] px-3.5 py-1.5 text-xs font-bold transition-colors ${on ? "bg-[#222325] text-[#e1f073]" : "text-gray-600 hover:text-[#222325]"}`}>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xl">
        <span className="font-bold text-primary">Blogs</span> <span className="text-lg font-extralight italic text-gray-400">{`(${view.count})`}</span>
      </p>
      <hr className="mb-5" />

      {!loading && view.rows.length === 0 ? (
        <div className="rounded-md border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-lg font-bold text-primary">{mine ? "You haven't written any blogs yet." : "No blogs yet."}</p>
          {hasAuthorProfile && (
            <Link href="/heroshima/blogs/create" className="drop-shadow-secondary2-hover mt-4 inline-flex h-10 items-center rounded-sm border-2 border-primary bg-white px-4 text-sm font-bold transition-all">
              Write one
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? <BlogTileSkeleton amount={6} /> : view.rows.map((blog) => <BlogTile key={blog.id} blog={blog} />)}
        </div>
      )}

      <PaginationControl
        handlePrevious={() => view.page > 1 && load(view.scope, view.page - 1)}
        handleNext={() => view.page < totalPages && load(view.scope, view.page + 1)}
        currentPage={view.page}
        totalPages={totalPages}
        dataTotal={view.count}
        startIndex={(view.page - 1) * PER_PAGE}
        endIndex={view.page * PER_PAGE}
      />
    </div>
  );
};

export default AllBlogsClient;
