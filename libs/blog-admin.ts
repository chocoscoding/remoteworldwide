"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction, requireRoleAction } from "@/app/lib/auth/action-guards";
import { backend, BackendError, backendOrNull, idSegment, isObjectId, type BackendInit } from "@/app/lib/backend";
import type { Author, BlogSettings, Cta, CtaImageSide, CtaTone, LeadMagnet, PostFull, Subscriber } from "@/app/lib/blog/types";
import { renderArticle, type ArticleOffers } from "@/app/lib/blog/article";

export interface LeadMagnetInput {
  slug?: string;
  title: string;
  hook: string;
  bullets: string[];
  buttonLabel: string;
  fileUrl: string;
  fileName: string;
  coverImage?: string | null;
  targetCategories: string[];
  targetTags: string[];
  active: boolean;
}

export interface CtaInput {
  key?: string;
  name: string;
  eyebrow?: string | null;
  headline: string;
  body: string;
  buttonLabel: string;
  href: string;
  tone: CtaTone;
  imageUrl?: string | null;
  imageSide?: CtaImageSide;
  targetCategories: string[];
  targetTags: string[];
  active: boolean;
}

export interface BlogSettingsInput {
  flagshipLeadMagnetSlug: string | null;
  defaultCtaKey: string | null;
  indexCtaKey: string | null;
  categoryLeadMagnets: Record<string, string>;
  categoryCtas: Record<string, string>;
}

export type ConversionKind = "cta" | "magnet";
export type LeadMagnetRow = LeadMagnet & { _count: { blogs: number; claimRecords: number } };
export interface PickRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  featuredRank: number | null;
}

const admin = <T>(path: string, init: BackendInit = {}) => backend<T>(`/blog/admin${path}`, { ...init, session: true });

// Every export is a public endpoint (app/lib/auth/action-guards.ts) and the
// backend's isWriter/isAdmin stays the real boundary. Each export still refuses
// a caller without the role first, with the role of the route it calls
// (`writer()` for isWriter, requireAdminAction for isAdmin), so an anonymous or
// USER call fails at the edge rather than on the backend's word alone, as in
// libs/query.ts. Until 2026-10-15 only the id-taking exports checked, which left
// the creates, the settings save, the preview and the reads to the backend alone.
// Each check is one session read, far inside the backend's per-visitor /api/auth
// budget even on a page that fans out four of these at once.
// The exports that take an id pass it through `idSegment` so an argument names
// one resource, never a path. The three (fulladmin)-only ones (settings row,
// stats, featured rank) refuse an AUTHOR here only to match their one screen,
// not as a boundary: the backend routes behind them are isWriter on purpose and
// answer straight through the /api/blog rewrite, so an author can still read the
// row and stats and set a rank there (and on their own post through BlogForm).
const writer = () => requireRoleAction("ADMIN", "AUTHOR");

// `kind` is a union only to TypeScript; at runtime it is whatever was sent.
const OFFER_KINDS: readonly string[] = ["cta", "magnet"] satisfies ConversionKind[];

const revalidateBlog = () => {
  revalidatePath("/blogs");
  revalidatePath("/blogs", "layout");
};

async function attempt<T>(run: () => Promise<T>): Promise<{ data: T; error?: never } | { error: string; data?: never }> {
  try {
    const data = await run();
    revalidateBlog();
    return { data };
  } catch (error) {
    if (error instanceof BackendError && error.status < 500) return { error: error.message };
    throw error;
  }
}

export const listLeadMagnets = async () => {
  await writer();
  return admin<LeadMagnetRow[]>("/lead-magnets");
};
// The edit page hands this its URL param. A malformed id names nothing: null, like a 404.
export const getLeadMagnet = async (id: string) => {
  await writer();
  return isObjectId(id) ? backendOrNull<LeadMagnet>(`/blog/admin/lead-magnets/${id}`, { session: true }) : null;
};
export const createLeadMagnet = async (input: LeadMagnetInput) => {
  await writer();
  return attempt(() => admin<LeadMagnet>("/lead-magnets", { method: "POST", body: input }));
};
// `idSegment` runs inside `attempt`, so a malformed id comes back as the form's error, not a crash.
export const updateLeadMagnet = async (id: string, input: Partial<LeadMagnetInput>) => {
  await writer();
  return attempt(() => admin<LeadMagnet>(`/lead-magnets/${idSegment(id)}`, { method: "PUT", body: input }));
};
export const deleteLeadMagnet = async (id: string) => {
  await writer();
  await admin(`/lead-magnets/${idSegment(id)}`, { method: "DELETE" });
  revalidateBlog();
  return { status: "deleted" };
};

export const listCtas = async () => {
  await writer();
  return admin<Cta[]>("/ctas");
};
export const getCta = async (id: string) => {
  await writer();
  return isObjectId(id) ? backendOrNull<Cta>(`/blog/admin/ctas/${id}`, { session: true }) : null;
};
export const createCta = async (input: CtaInput) => {
  await writer();
  return attempt(() => admin<Cta>("/ctas", { method: "POST", body: input }));
};
export const updateCta = async (id: string, input: Partial<CtaInput>) => {
  await writer();
  return attempt(() => admin<Cta>(`/ctas/${idSegment(id)}`, { method: "PUT", body: input }));
};
export const deleteCta = async (id: string) => {
  await writer();
  await admin(`/ctas/${idSegment(id)}`, { method: "DELETE" });
  revalidateBlog();
  return { status: "deleted" };
};

export const listConversions = async () => {
  await writer();
  return admin<{ magnets: LeadMagnetRow[]; ctas: Cta[] }>("/conversions");
};

export const setOfferActive = async (kind: ConversionKind, id: string, active: boolean) => {
  await writer();
  if (!OFFER_KINDS.includes(kind)) throw new BackendError(400, "kind must be cta or magnet");
  const result = await admin<{ active: boolean }>(`/offers/${kind}/${idSegment(id)}/active`, { method: "PATCH", body: { active } });
  revalidateBlog();
  return result;
};

// Admin-only here because only the (fulladmin) blog-settings screen calls it.
// The backend lets writers read the row on purpose (offer slugs and keys the
// public pages render anyway), so this is the stricter of the two, not a mirror.
export const getBlogSettingsRow = async () => {
  await requireAdminAction();
  return admin<BlogSettings>("/settings");
};
// The write is isAdmin on the backend too, so this one is a mirror, not the stricter side.
export const saveBlogSettings = async (input: BlogSettingsInput) => {
  await requireAdminAction();
  return attempt(() => admin<BlogSettings>("/settings", { method: "PUT", body: input }));
};

export const listPicks = async () => {
  await writer();
  return admin<PickRow[]>("/posts/picks");
};
// The (fulladmin) "Start here" picker's action. The backend route stays isWriter:
// writers set the same rank on their post through BlogForm's "Start here rank".
export const setFeaturedRank = async (blogId: string, featuredRank: number | null) => {
  await requireAdminAction();
  const result = await admin<{ featuredRank: number | null }>(`/posts/${idSegment(blogId)}/featured`, { method: "PATCH", body: { featuredRank } });
  revalidateBlog();
  return { data: result };
};

// Subscriber emails: isAdmin on the backend, so ADMIN here as well.
export const listSubscribers = async (page: number) => {
  await requireAdminAction();
  return admin<{ rows: Subscriber[]; total: number; page: number; pageSize: number }>(`/subscribers?page=${page}`);
};

// Only the (fulladmin) blog-settings screen shows these totals.
export const blogConversionStats = async () => {
  await requireAdminAction();
  return admin<{
    subscribers: number;
    claims: number;
    posts: number;
    magnets: { slug: string; title: string; claims: number; downloads: number; active: boolean }[];
    ctas: { key: string; name: string; clicks: number; active: boolean }[];
  }>("/stats");
};

export interface LinkableUser {
  id: string;
  name: string | null;
  email: string | null;
}

export interface PreviewInput {
  content: string;
  category: string;
  tags: string[];
  leadMagnetId: string | null;
  ctaKey: string | null;
  inlineOffers: string[];
}

// The one export left open: GET /blog/authors is public on the backend.
export const listAuthorPicks = async () => backend<Author[]>("/blog/authors");
// The (admin) layout calls this for every staff render behind `.catch(() => null)`, so
// a refusal there still reads as "no author profile".
export const myAuthor = async () => {
  await writer();
  return backendOrNull<Author>("/blog/admin/authors/me", { session: true });
};
// Every account's name and email: isAdmin on the backend.
export const listLinkableUsers = async () => {
  await requireAdminAction();
  return admin<LinkableUser[]>("/authors/users");
};

export const previewBlog = async (input: PreviewInput) => {
  await writer();
  const { content, inlineOffers, ...draft } = input;
  const offers = await admin<ArticleOffers & { settings: BlogSettings }>("/posts/preview", { method: "POST", body: draft });
  return { ...offers, rendered: renderArticle({ content, inlineOffers, autoCtas: false }, offers) };
};

export interface MyAuthorInput {
  name: string;
  about: string;
  profileImage: string;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
  instagram: string | null;
}

export type AdminPostScope = "mine" | "all";

export const createMyAuthor = async (input: MyAuthorInput) => {
  await writer();
  return attempt(() => admin<Author>("/authors/me", { method: "POST", body: input }));
};
export const updateMyAuthor = async (input: MyAuthorInput) => {
  await writer();
  return attempt(() => admin<Author>("/authors/me", { method: "PUT", body: input }));
};

export const listAdminPosts = async (page: number, scope: AdminPostScope) => {
  await writer();
  return admin<{ data: PostFull[]; count: number }>(`/posts?page=${page}${scope === "mine" ? "&mine=1" : ""}`);
};
