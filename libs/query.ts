"use server";

// Every export here is a server action: a POST endpoint anyone holding its id can
// call with any arguments, whichever page imports it — the admin route groups'
// notFound() gates the page, not the action. So each one opens with its own check
// (app/lib/auth/action-guards.ts), placed before its `try` so a refusal leaves as
// the ActionAuthError it is instead of being rewrapped by the catch or `surface`.
//   - The board (jobs, companies, the dashboard counts) is ADMIN's, the same
//     positive check as the REST routes behind requireAdmin: an AUTHOR may neither
//     write it nor list the inactive listings.
//   - Posts are the writers' (ADMIN or AUTHOR) and author profiles are ADMIN's. The
//     backend's isWriter/isAdmin already enforce that; checking here too makes an
//     anonymous call fail at the edge rather than on the backend's word alone.
//   - Bookmarks belong to the session's user. They once took a `userId` argument,
//     and their ids ship on every public job page, so any visitor could read,
//     add or delete anyone's.
//   - The public reads (latest jobs, the active count, filters) stay open and
//     return only active listings and public fields.

import { revalidatePath, updateTag } from "next/cache";
import { backend, BackendError, backendCached, backendOrNull, BOARD_TAGS, idSegment, isObjectId, type BackendInit } from "@/app/lib/backend";
import type { Company, CompanyWithJobsCount, FilterData, Job, OneBookmarkType } from "@/types/main";
import type { Author, Blog, BlogStatus, EditableBlog } from "@/app/lib/blog/types";
import { requireAdminAction, requireRoleAction, requireUserAction } from "@/app/lib/auth/action-guards";

// The job board lives in the backend (remoteworldwidebackend routes/job.routes.ts /jobs/admin,
// company.routes.ts, bookmark.routes.ts) since 2026-10-20; the website has no database client. These
// actions keep their names and shapes, so no page changed, and expire the board's cached reads
// (BOARD_TAGS) and pages after a write.

/** A board refusal in the backend's own words ("Company already exist", "Job not found"), as the Prisma actions threw them. */
const boardError = (error: unknown): never => {
  throw new Error(error instanceof BackendError ? error.message : "something went wrong");
};

/** After a listing write: the cached board reads, the home page, and the listing's own page. */
const listingsChanged = (...slugs: (string | undefined)[]) => {
  updateTag(BOARD_TAGS.jobs);
  revalidatePath("/");
  for (const slug of slugs) if (slug) revalidatePath(`/jobs/${slug}`);
};

const jobAdmin = <T,>(path: string, init: BackendInit = {}) => backend<T>(`/jobs/admin${path}`, { ...init, session: true });

export const deleteOneJob = async (id: string) => {
  await requireAdminAction();
  try {
    const { slug } = await jobAdmin<{ slug: string }>(`/${idSegment(id)}`, { method: "DELETE" });
    listingsChanged(slug);
    return { status: "deleted job successfully" };
  } catch (error) {
    return boardError(error);
  }
};

export const toggleJobActiveState = async (id: string, state: boolean) => {
  await requireAdminAction();
  try {
    const job = await jobAdmin<Job>(`/${idSegment(id)}/active`, { method: "PATCH", body: { isActive: state } });
    listingsChanged(job.slug);
    return { status: "updated job successfully" };
  } catch (error) {
    return boardError(error);
  }
};

export type JobCreate = Pick<Job, "title" | "description" | "companyId" | "applicationUrl" | "category" | "seniority"> & { region: string[] | string };

// The admin's "Create job". Every field is required; the backend names the first one missing.
export const createOneJob = async (jobDetails: JobCreate) => {
  await requireAdminAction();
  const { title, description, companyId, applicationUrl, category, region, seniority } = jobDetails;
  try {
    const data = await jobAdmin<Job>("", { method: "POST", body: { title, description, companyId, applicationUrl, category, region, seniority } });
    listingsChanged();
    return { data };
  } catch (error) {
    return boardError(error);
  }
};

// The fields the edit form owns, named one by one so a direct call cannot set `isActive`
// (publishing is toggleJobActiveState's job) or `createdAt` (which orders the board).
type JobEdit = Pick<Job, "title" | "description" | "companyId" | "applicationUrl" | "category" | "region" | "seniority" | "slug">;

export const updateOneJob = async (id: string, jobDetails: JobEdit) => {
  await requireAdminAction();
  try {
    const { title, description, companyId, applicationUrl, category, region, seniority, slug } = jobDetails;
    const { previousSlug, ...data } = await jobAdmin<Job & { previousSlug: string }>(`/${idSegment(id)}`, {
      method: "PUT",
      body: { title, description, companyId, applicationUrl, category, region, seniority, slug },
    });
    listingsChanged(previousSlug, data.slug);
    return { data };
  } catch (error) {
    return boardError(error);
  }
};

export const findJobsAdmin = async (page: number, active: boolean) => {
  await requireAdminAction();
  try {
    const { items, count } = await jobAdmin<{ items: JobListItem[]; count: number }>(`?active=${active}&page=${Math.max(1, page | 0)}`);
    return { data: items, count };
  } catch (error) {
    return boardError(error);
  }
};

/** A listing in a board list, as the backend sends it (BoardJobItem, with the description on the admin's). */
type JobListItem = Pick<Job, "id" | "slug" | "title" | "isActive" | "applicationUrl" | "createdAt" | "updatedAt" | "category" | "region" | "seniority"> & {
  description?: string;
  company: { name: string; logo: string; slug: string };
};

// The admin view of a company. The public /companies pages read the same company through the
// backend's /api/companies, and its listings through /api/jobs/company, which shows live ones only.
export const findCompany = async (slug: string) => {
  await requireAdminAction();
  try {
    const company = await backendOrNull<CompanyWithJobsCount>(`/companies/${encodeURIComponent(slug)}`);
    return company ? { data: company } : null;
  } catch (error) {
    return boardError(error);
  }
};

export const findCompanyJobs = async (companyId: string, page: number) => {
  await requireAdminAction();
  try {
    const { items, count } = await backend<{ items: JobListItem[]; count: number }>(
      `/companies/admin/${idSegment(companyId)}/jobs?page=${Math.max(1, page | 0)}`,
      { session: true }
    );
    return { data: items, count };
  } catch (error) {
    return boardError(error);
  }
};

// Company and filter writes, the admin's. They were the browser's own calls to app/api/companies
// and app/api/filters; as actions they can expire the cached pages that show them. A refusal the
// admin can fix ("Company already exist", "This company still has jobs") comes back as `{ error }`
// in the backend's words, because production hides a thrown action's message.
const boardRefused = (error: unknown): { error: string } => {
  if (error instanceof BackendError && error.status < 500) return { error: error.message };
  console.error("[query] board write:", error);
  return { error: "something went wrong" };
};

export type CompanyInput = Pick<Company, "name" | "about" | "website"> & {
  logo: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
};

const companiesChanged = (...slugs: (string | undefined)[]) => {
  updateTag(BOARD_TAGS.companies);
  revalidatePath("/companies");
  for (const slug of slugs) if (slug) revalidatePath(`/companies/${slug}`);
};

export const createCompany = async (input: CompanyInput): Promise<{ data: Company } | { error: string }> => {
  await requireAdminAction();
  try {
    const data = await backend<Company>("/companies", { method: "POST", body: input, session: true });
    companiesChanged(data.slug);
    return { data };
  } catch (error) {
    return boardRefused(error);
  }
};

export const updateCompany = async (id: string, input: CompanyInput): Promise<{ data: Company } | { error: string }> => {
  await requireAdminAction();
  try {
    const data = await backend<Company>(`/companies/${idSegment(id)}`, { method: "PUT", body: input, session: true });
    companiesChanged(data.slug);
    // A listing's page shows its company's panel.
    updateTag(BOARD_TAGS.jobs);
    return { data };
  } catch (error) {
    return boardRefused(error);
  }
};

export const deleteCompany = async (id: string): Promise<{ data: Company } | { error: string }> => {
  await requireAdminAction();
  try {
    const data = await backend<Company>(`/companies/${idSegment(id)}`, { method: "DELETE", session: true });
    companiesChanged(data.slug);
    return { data };
  } catch (error) {
    return boardRefused(error);
  }
};

export type FilterKind = keyof FilterData;

export const createFilter = async (kind: FilterKind, name: string): Promise<{ data: { id: string; name: string } } | { error: string }> => {
  await requireAdminAction();
  try {
    const data = await backend<{ id: string; name: string }>(`/filters/${encodeURIComponent(kind)}`, { method: "POST", body: { name }, session: true });
    updateTag(BOARD_TAGS.filters);
    return { data };
  } catch (error) {
    return boardRefused(error);
  }
};

export const deleteFilter = async (kind: FilterKind, id: string): Promise<{ data: { id: string; name: string } } | { error: string }> => {
  await requireAdminAction();
  try {
    const data = await backend<{ id: string; name: string }>(`/filters/${encodeURIComponent(kind)}/${idSegment(id)}`, { method: "DELETE", session: true });
    updateTag(BOARD_TAGS.filters);
    return { data };
  } catch (error) {
    return boardRefused(error);
  }
};

// Every company as a dropdown option, for the job forms.
export const getCompanyOptions = async () => {
  await requireAdminAction();
  return backend<{ value: string; label: string }[]>("/companies/options", { session: true });
};

// heroshima/page.tsx returns early for an AUTHOR, so only ADMIN renders this.
export const getAdminDashboardInfo = async () => {
  await requireAdminAction();
  try {
    const [board, blogsCount] = await Promise.all([
      jobAdmin<{ latestJob: JobListItem[]; jobsCount: number; companiesCount: number }>("/dashboard"),
      admin<{ posts: number }>("/stats")
        .then((stats) => stats.posts)
        .catch((error) => {
          if (error instanceof BackendError) return 0;
          throw error;
        }),
    ]);

    return { ...board, blogsCount };
  } catch (error) {
    throw new Error("something went wrong");
  }
};

const admin = <T,>(path: string, init: BackendInit = {}) => backend<T>(`/blog/admin${path}`, { ...init, session: true });

const surface = (error: unknown): never => {
  throw new Error(error instanceof BackendError ? error.message : "something went wrong");
};

// How the post and author writes below answer a refusal the editor can fix. A thrown
// action message reaches the browser in development only: production swaps it for
// React's generic text, so "Author name taken, use another", a taken slug or "This
// author still has posts" all reached the editor as the same blank failure. A 4xx (the
// backend's validation, conflict, not-found and ownership answers, and idSegment's own
// 400) is therefore returned as `{ error }` in the backend's words, as libs/blog-admin.ts's
// `attempt` does; a 5xx or a dropped connection still throws through `surface`.
const refused = (error: unknown): { error: string } => {
  if (error instanceof BackendError && error.status < 500) return { error: error.message };
  return surface(error);
};

// The backend's isWriter, checked at the edge: posts are written by ADMIN or AUTHOR.
const requireWriterAction = () => requireRoleAction("ADMIN", "AUTHOR");

export type AuthorInput = Omit<Author, "id" | "createdAt" | "slug">;

export const createAuthor = async (body: AuthorInput) => {
  await requireAdminAction();
  try {
    return { data: await admin<Author>("/authors", { method: "POST", body }) };
  } catch (error) {
    return refused(error);
  }
};

// The ids below go through `idSegment` (app/lib/backend.ts): pasted raw, `../../..`
// turned "delete this post" into a request to any backend path under the caller's
// cookie. Inside the `try`, so a malformed id comes back as an `{ error }`, like the backend's own 400.
export const updateAuthor = async (id: string, body: AuthorInput) => {
  await requireAdminAction();
  try {
    return { data: await admin<Author>(`/authors/${idSegment(id)}`, { method: "PUT", body }) };
  } catch (error) {
    return refused(error);
  }
};

export const deleteAuthor = async (id: string) => {
  await requireAdminAction();
  try {
    await admin(`/authors/${idSegment(id)}`, { method: "DELETE" });
    return { status: "deleted author successfully" };
  } catch (error) {
    return refused(error);
  }
};

export const findAuthorBySlug = async (slug: string) => {
  await requireAdminAction();
  return { data: await backendOrNull<Author>(`/blog/admin/authors/${encodeURIComponent(slug)}`, { session: true }) };
};

// Nothing imports this now, but an export stays a live endpoint: the writers'
// check, like the isWriter route behind it.
export const allAuthorsSelect = async () => {
  await requireWriterAction();
  return admin<{ label: string; value: string }[]>("/authors/options");
};

export interface BlogConversionFields {
  category?: string;
  status?: BlogStatus;
  featuredRank?: number | null;
  leadMagnetId?: string | null;
  ctaKey?: string | null;
  autoCtas?: boolean;
  inlineOffers?: string[];
}

export interface BlogInput extends BlogConversionFields {
  title: string;
  content: string;
  description: string;
  authorIds: string[];
  tags: string[];
  coverImage: string;
  slug?: string;
}

export const createBlog = async (data: BlogInput) => {
  await requireWriterAction();
  try {
    const blog = await admin<Blog>("/posts", { method: "POST", body: data });
    revalidatePath("/blogs");
    return { data: blog };
  } catch (error) {
    return refused(error);
  }
};

export const getBlogBySlug = async (slug: string) => {
  await requireWriterAction();
  return { data: await backendOrNull<EditableBlog>(`/blog/admin/posts/${encodeURIComponent(slug)}`, { session: true }) };
};

export const getBlogById = async (id: string) => {
  await requireWriterAction();
  if (!isObjectId(id)) return { data: null };
  return { data: await backendOrNull<EditableBlog>(`/blog/admin/posts/id/${idSegment(id)}`, { session: true }) };
};

// Autosave. A draft is written in place; a published post's edits are kept as
// its edited version, so neither touches the public pages and nothing is revalidated.
export const createBlogDraft = async (data: Partial<BlogInput>) => {
  await requireWriterAction();
  try {
    return { data: await admin<EditableBlog>("/posts/draft", { method: "POST", body: data }) };
  } catch (error) {
    return refused(error);
  }
};

export const autosaveBlog = async (id: string, data: Partial<BlogInput>) => {
  await requireWriterAction();
  try {
    return { data: await admin<EditableBlog>(`/posts/${idSegment(id)}/autosave`, { method: "PATCH", body: data }) };
  } catch (error) {
    return refused(error);
  }
};

/** Publish a draft, or put a published post's edited version live. */
export const publishBlog = async (id: string) => {
  await requireWriterAction();
  try {
    const blog = await admin<EditableBlog>(`/posts/${idSegment(id)}/publish`, { method: "POST" });
    revalidatePath("/blogs");
    for (const slug of [blog.slug, ...blog.previousSlugs]) revalidatePath("/blogs/" + slug);
    return { data: blog };
  } catch (error) {
    return refused(error);
  }
};

export const discardBlogEdit = async (id: string) => {
  await requireWriterAction();
  try {
    return { data: await admin<EditableBlog>(`/posts/${idSegment(id)}/pending`, { method: "DELETE" }) };
  } catch (error) {
    return refused(error);
  }
};

export const editBlog = async (id: string, data: Partial<BlogInput>) => {
  await requireWriterAction();
  try {
    const blog = await admin<Blog>(`/posts/${idSegment(id)}`, { method: "PUT", body: data });
    revalidatePath("/blogs");
    for (const slug of [blog.slug, ...blog.previousSlugs]) revalidatePath("/blogs/" + slug);
    return { data: blog };
  } catch (error) {
    return refused(error);
  }
};

export const deleteBlog = async (id: string) => {
  await requireWriterAction();
  try {
    await admin(`/posts/${idSegment(id)}`, { method: "DELETE" });
    revalidatePath("/blogs");
    return { status: "deleted blog successfully" };
  } catch (error) {
    return refused(error);
  }
};

// How a failure reaches a caller who is not an admin. Development forwards a thrown
// message to the browser (production already hides it). These callers show their own
// fixed copy, so the detail stays in the server log and the caller gets the same words
// in every environment.
const opaque = (action: string, error: unknown): never => {
  console.error(`[query] ${action}:`, error);
  throw new Error("something went wrong");
};

// The bookmarks below are the session user's own: the backend reads the user from the
// session cookie, never from an argument.
export const getAllBookmarksForUser = async (page: number) => {
  await requireUserAction();
  try {
    const { items, count } = await backend<{ items: OneBookmarkType[]; count: number }>(`/bookmarks?page=${Math.max(1, page | 0)}`, { session: true });
    return { data: items, count };
  } catch (error) {
    return opaque("getAllBookmarksForUser", error);
  }
};

//delete a bookmark
export const deleteBookmarkForUser = async (jobId: string) => {
  await requireUserAction();
  try {
    await backend(`/bookmarks/${idSegment(jobId)}`, { method: "DELETE", session: true });
    return { status: "deleted bookmark successfully" };
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) throw new Error("Record to delete does not exist");
    return opaque("deleteBookmarkForUser", error);
  }
};

//crate a bookmark
// Only a live listing can be saved; the backend refuses any other id with "Job not found".
export const createBookmarkForUser = async (jobId: string) => {
  await requireUserAction();
  try {
    if (!isObjectId(jobId)) throw new BackendError(404, "Job not found");
    return { data: await backend<BookmarkRow>("/bookmarks", { method: "POST", body: { jobId }, session: true }) };
  } catch (error) {
    if (error instanceof BackendError && (error.status === 404 || error.status === 409)) throw new Error(error.message);
    return opaque("createBookmarkForUser", error);
  }
};

type BookmarkRow = { id: string; userId: string; jobId: string; createdAt: Date };

//check if a user has job bookmarked
export const checkBookmarkForUser = async (jobId: string) => {
  await requireUserAction();
  try {
    if (!isObjectId(jobId)) return { data: null };
    return { data: await backend<BookmarkRow | null>(`/bookmarks/${idSegment(jobId)}`, { session: true }) };
  } catch (error) {
    return opaque("checkBookmarkForUser", error);
  }
};

// The public reads below sit in Next's data cache (backendCached), so the cached home and
// waitlist pages stay cached; an admin's write expires them through BOARD_TAGS.
const BOARD_CACHE_S = 600;

export const getAllActiveJobsCount = async () => {
  try {
    const { count } = await backendCached<{ count: number }>("/jobs/active-count", { revalidate: BOARD_CACHE_S, tags: [BOARD_TAGS.jobs] });
    return { count };
  } catch {
    return { count: null };
  }
};

export const getFilters = async () => {
  try {
    return { data: await backendCached<FilterData>("/filters", { revalidate: BOARD_CACHE_S, tags: [BOARD_TAGS.filters] }) };
  } catch (error) {
    return opaque("getFilters", error);
  }
};

// Public, like the home page that calls it with 10. Capped at 50 here and in the backend.
export const fetchLatestJobs = async (amount: number) => {
  const take = Math.min(Math.max(1, amount | 0), 50);
  try {
    return { data: await backendCached<JobListItem[]>(`/jobs/latest?amount=${take}`, { revalidate: BOARD_CACHE_S, tags: [BOARD_TAGS.jobs] }) };
  } catch (error) {
    return opaque("fetchLatestJobs", error);
  }
};
