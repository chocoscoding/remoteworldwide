import { it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import nextConfig from "../next.config.mjs";

// /jobs/<slug> is a cached listing (jobs/[id]) or a cached landing page (jobs/landing/[slug]); the
// rewrites in next.config.mjs decide which. Missing a listing slug shape sends every such listing to
// the landing route (2026-11-21: all listings posted since Nov 5 ended in "-<8 hex>" and, while that
// route rendered per request, ran on every visit). A landing's ?page=N moves into the path, because
// a cached page may not read the query string (2026-11-23: reading it made every landing visit a
// function run, ~24K in 12 hours).
const require = createRequire(import.meta.url);
const { pathToRegexp } = require("next/dist/compiled/path-to-regexp");
const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match");
const { matchHas } = require("next/dist/shared/lib/router/utils/prepare-destination");

const rewrites = await nextConfig.rewrites();
const redirects = await nextConfig.redirects();
const rule = rewrites.find((r) => r.destination === "/jobs/landing/:slug");
const toLanding = (slug) => pathToRegexp(rule.source, [], { strict: true, sensitive: false, delimiter: "/" }).test(`/jobs/${slug}`);

/** Where Next sends an address: the first rule whose path and `has` items match, as resolve-routes does. */
function resolve(rules, url) {
  const { pathname, searchParams } = new URL(url, "https://example.com");
  const query = Object.fromEntries(searchParams);
  for (const r of rules) {
    const params = getPathMatch(r.source, { removeUnnamedParams: true, strict: true })(pathname);
    if (!params) continue;
    const hasParams = matchHas({ headers: {} }, query, r.has, r.missing);
    if (!hasParams) continue;
    const all = { ...params, ...hasParams };
    return r.destination.replace(/:(\w+)/g, (_, key) => all[key]);
  }
  return null;
}
const rewriteOf = (url) => resolve(rewrites.filter((r) => r.destination.startsWith("/jobs")), url);
const redirectOf = (url) => resolve(redirects, url);

it("keeps every listing slug shape on the cached job page", () => {
  for (const slug of ["senior-llm-engineer-tts-f42ba172", "email-designer-c67c0e9a", "support-specialist-DEADBEEF", "old-style-abc1234567890123"]) {
    assert.equal(toLanding(slug), false, slug);
    assert.equal(rewriteOf(`/jobs/${slug}?page=2`), null, `${slug}?page=2`);
  }
});

it("still sends landing pages and hand-written slugs to the landing route", () => {
  for (const slug of ["usa", "worldwide", "latin-america", "frontend", "customer-support", "ai-ml", "h1b", "latest", "entry-level", "uk-visa-sponsorship", "eu-blue-card", "salary-100k-usd", "hand-written-admin-slug"]) {
    assert.equal(toLanding(slug), true, slug);
  }
});

it("moves a landing's ?page=N into the path of a cached route", () => {
  assert.equal(rewriteOf("/jobs/europe"), "/jobs/landing/europe");
  assert.equal(rewriteOf("/jobs/europe?utm_source=x"), "/jobs/landing/europe");
  assert.equal(rewriteOf("/jobs/europe?page=3"), "/jobs/landing/europe/3");
  assert.equal(rewriteOf("/jobs/latest?page=2&utm_source=x"), "/jobs/landing/latest/2");
  // A bad number still reaches the page, which answers 404 as it always has.
  assert.equal(rewriteOf("/jobs/usa?page=abc"), "/jobs/landing/usa/abc");
  assert.equal(rewriteOf("/jobs/software-engineer/uk?page=2"), "/jobs/software-engineer/uk/2");
  // Page 1 of a two-segment landing is its own folder (jobs/[id]/[segment]): no rewrite needed.
  assert.equal(rewriteOf("/jobs/software-engineer/uk"), null);
});

it("uses one landing slug rule for both the page and the ?page= rewrite", () => {
  const paged = rewrites.find((r) => r.destination === "/jobs/landing/:slug/:page");
  assert.equal(paged.source, rule.source);
});

it("never serves the internal page-number routes at their own address", () => {
  assert.equal(redirectOf("/jobs/landing/europe"), "/jobs/europe");
  assert.equal(redirectOf("/jobs/landing/europe/2"), "/jobs/europe?page=2");
  assert.equal(redirectOf("/jobs/software-engineer/uk/2"), "/jobs/software-engineer/uk?page=2");
  assert.equal(redirectOf("/jobs/europe"), null);
  assert.equal(redirectOf("/jobs/software-engineer/uk"), null);
});

it("has no static landing folder under /jobs, which would answer every ?page= with page 1", () => {
  const folders = readdirSync(new URL("../app/(pages)/(general)/jobs/", import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(folders, ["(main)", "[id]", "landing"]);
});
