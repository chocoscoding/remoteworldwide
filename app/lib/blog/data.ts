import { backend, backendCachedOrNull, backendOrNull } from "@/app/lib/backend";
import { BLOG_CATEGORIES, categoryBySlug, type BlogCategory } from "./categories";
import type { Author, BlogSettings, Cta, LeadMagnet, Offers, PostCard, PostFull } from "./types";

export const POSTS_PER_PAGE = 12;

export type { Blog, Cta, LeadMagnet, PostCard, PostFull } from "./types";
export type ResolvedSettings = BlogSettings;

export interface PostList {
  posts: PostCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getPublishedPosts(opts: { page?: number; category?: string | null; pageSize?: number } = {}): Promise<PostList> {
  const params = new URLSearchParams();
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.category) params.set("category", opts.category);
  const qs = params.toString();
  return backend<PostList>(`/blog/posts${qs ? `?${qs}` : ""}`);
}

export function getFeaturedPosts(limit = 4, exceptSlug?: string): Promise<PostCard[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (exceptSlug) params.set("except", exceptSlug);
  return backend<PostCard[]>(`/blog/posts/featured?${params.toString()}`);
}

export async function getCategoriesWithCounts(): Promise<(BlogCategory & { count: number })[]> {
  const counts = await backend<Record<string, number>>("/blog/categories");
  return BLOG_CATEGORIES.map((c) => ({ ...c, count: counts[c.slug] ?? 0 }));
}

export function getOffers(category?: string | null): Promise<Offers> {
  return backend<Offers>(`/blog/offers${category ? `?category=${encodeURIComponent(category)}` : ""}`);
}

export interface PostPageData {
  post: PostFull;
  category: BlogCategory | null;
  leadMagnet: LeadMagnet | null;
  cta: Cta | null;
  magnets: LeadMagnet[];
  ctas: Cta[];
  featured: PostCard[];
  related: PostCard[];
  settings: BlogSettings;
}

/** A post as its writer sees it, drafts included (the admin's view, /heroshima/blogs/[slug]). Sends the session. */
export async function getPostPageData(slug: string): Promise<PostPageData | null> {
  const data = await backendOrNull<Omit<PostPageData, "category">>(`/blog/posts/${encodeURIComponent(slug)}`, { session: true });
  return data ? { ...data, category: categoryBySlug(data.post.category) ?? null } : null;
}

/**
 * How long a cached blog page or read lasts before it is rebuilt. Publishing, editing or deleting a
 * post (and the offer, pick and author changes) refresh every page under /blogs at once
 * (revalidatePath in libs/query.ts and libs/blog-admin.ts); this only catches anything they miss.
 */
export const BLOG_REVALIDATE_S = 3600;

/**
 * A post as readers see it: published only, named to no visitor, so the public post page can be
 * cached. A draft answers 404 here; writers preview drafts in the admin's view instead.
 */
export async function getPublishedPostPageData(slug: string): Promise<PostPageData | null> {
  const data = await backendCachedOrNull<Omit<PostPageData, "category">>(`/blog/posts/${encodeURIComponent(slug)}`, { revalidate: BLOG_REVALIDATE_S, tags: [] });
  return data ? { ...data, category: categoryBySlug(data.post.category) ?? null } : null;
}

export function getPostByPreviousSlug(slug: string): Promise<{ slug: string } | null> {
  return backendCachedOrNull<{ slug: string }>(`/blog/redirects/${encodeURIComponent(slug)}`, { revalidate: BLOG_REVALIDATE_S, tags: [] });
}

export function getSitemapEntries(): Promise<{ posts: { slug: string; updatedAt: Date }[]; authors: { slug: string }[] }> {
  return backend("/blog/sitemap");
}

export type AuthorWithPosts = Author & { blogs: PostCard[]; _count: { blogs: number } };

export const getAuthors = () => backend<(Author & { _count: { blogs: number } })[]>("/blog/authors");
export const getAuthorProfile = (slug: string) => backendOrNull<AuthorWithPosts>(`/blog/authors/${encodeURIComponent(slug)}`);
