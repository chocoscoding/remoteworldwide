// Browser-side calls for the signed-in user's job-board bookmarks.
//
// Relative paths through the `/api/bookmarks/*` rewrite in next.config.mjs, so the Auth.js
// cookie rides along first-party and the backend's own guard (isAuthenticated, which also
// refuses a locked account) decides who is asking. They were server actions until 2026-11-21:
// a server action is a function run on this server at the page's own address, so every
// signed-in visit to any job page cost one, which asked the backend for the session and then
// for the bookmark (Vercel logs, "[auth] session resolved" on /jobs/...). A rewrite to the
// backend runs no function here.

import { apiDelete, apiGet, apiPost } from "@/app/lib/api/client";
import type { OneBookmarkType } from "@/types/main";

const BOOKMARKS_PATH = "/api/bookmarks";

type BookmarkRow = { id: string; userId: string; jobId: string; createdAt: string };

/** A listing id is a 24-hex ObjectId; anything else is answered here rather than sent into the path. */
const isObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

export const bookmarksApi = {
  /** One page (30) of the user's bookmarks with the total. */
  async list(page: number): Promise<{ data: OneBookmarkType[]; count: number }> {
    const { items, count } = await apiGet<{ items: OneBookmarkType[]; count: number }>(`${BOOKMARKS_PATH}?page=${Math.max(1, page | 0)}`);
    return { data: items, count };
  },

  /** The user's bookmark on this listing, or null. */
  async check(jobId: string): Promise<BookmarkRow | null> {
    if (!isObjectId(jobId)) return null;
    return apiGet<BookmarkRow | null>(`${BOOKMARKS_PATH}/${encodeURIComponent(jobId)}`);
  },

  /** Only a live listing can be saved; the backend refuses any other id with "Job not found". */
  add(jobId: string): Promise<BookmarkRow> {
    if (!isObjectId(jobId)) return Promise.reject(new Error("Job not found"));
    return apiPost<BookmarkRow>(BOOKMARKS_PATH, { jobId });
  },

  remove(jobId: string): Promise<unknown> {
    if (!isObjectId(jobId)) return Promise.reject(new Error("Record to delete does not exist"));
    return apiDelete(`${BOOKMARKS_PATH}/${encodeURIComponent(jobId)}`);
  },
};
