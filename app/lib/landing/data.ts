import { cache } from "react";
import { backend, backendCachedWithCount, backendWithCount, BOARD_TAGS } from "@/app/lib/backend";
import type { BoardJobItem } from "@/app/lib/jobs/searchJobs";
import type { CompanyList } from "@/types/main";
import {
  landingApiPath,
  LANDING_REVALIDATE,
  MIN_INDEXABLE,
  type CompanyLanding,
  type JobLanding,
  type Landing,
} from "./catalogue";
export const PER_PAGE = 50;
export type LandingPage<T> = { data: T[]; count: number } | null;
// A landing page's list, from Next's data cache. The landing routes are cached pages (ISR), so this
// must not read the visitor: backendWithCount() reads the request's headers, which made every visit
// to /jobs/europe, /jobs/usa, ... a function run plus a backend search (~24K in 12 hours, Vercel,
// 2026-11-23). The tags let an admin's listing or company write expire the lists at once
// (libs/query.ts). A failed read throws instead of returning an empty list: a cached page keeps its
// last good copy, rather than storing "could not load" (and noindex) for an hour.
const LIST_CACHE = {
  jobs: { revalidate: LANDING_REVALIDATE, tags: [BOARD_TAGS.jobs] },
  companies: { revalidate: LANDING_REVALIDATE, tags: [BOARD_TAGS.companies, BOARD_TAGS.jobs] },
};
export const landingJobs = cache(
  (landing: JobLanding, page: number) =>
    backendCachedWithCount<BoardJobItem[]>(landingApiPath(landing, page), LIST_CACHE.jobs),
);
export const landingCompanies = cache(
  (landing: CompanyLanding, page: number) =>
    backendCachedWithCount<CompanyList[]>(landingApiPath(landing, page), LIST_CACHE.companies),
);
export const totalPages = (count: number) =>
  Math.max(1, Math.ceil(count / PER_PAGE));
export const indexable = (result: LandingPage<unknown>) =>
  Boolean(result && result.count >= MIN_INDEXABLE);
export type LandingInventory = {
  landing: Landing;
  updatedAt: string | Date | null;
};
/** Sitemap counts are batched, not hundreds of fifty-row list fetches. Any failed batch aborts the sitemap. */
export async function landingInventory(
  landings: Landing[],
): Promise<LandingInventory[]> {
  const jobs = landings.filter((l): l is JobLanding => l.kind === "jobs"),
    result: LandingInventory[] = [];
  await Promise.all(
    Array.from({ length: Math.ceil(jobs.length / 100) }, async (_, batch) => {
      const start = batch * 100;
      const group = jobs.slice(start, start + 100);
      const rows = await backend<
        { key: string; count: number; updatedAt: string | null }[]
      >("/jobs/landing-counts", {
        method: "POST",
        body: {
          landings: group.map((landing) => ({
            key: landing.slug,
            query: landing.query,
          })),
        },
      });
      const byKey = new Map(rows.map((row) => [row.key, row]));
      for (const landing of group) {
        const row = byKey.get(landing.slug);
        if (!row) throw new Error("Incomplete landing inventory");
        if (row.count >= MIN_INDEXABLE)
          result.push({ landing, updatedAt: row.updatedAt });
      }
    }),
  );
  await Promise.all(
    landings
      .filter((l): l is CompanyLanding => l.kind === "companies")
      .map(async (landing) => {
        const page = await backendWithCount<CompanyList[]>(
          landingApiPath(landing, 1),
        );
        if (indexable(page)) result.push({ landing, updatedAt: null });
      }),
  );
  return result.sort(
    (a, b) => landings.indexOf(a.landing) - landings.indexOf(b.landing),
  );
}
export async function indexableLandings(
  landings: Landing[],
): Promise<Landing[]> {
  return (await landingInventory(landings)).map((row) => row.landing);
}
