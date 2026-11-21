import { it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import nextConfig from "../next.config.mjs";

// /jobs/<slug> is a cached listing or a per-request landing page; the rewrite in next.config.mjs
// decides which. Missing a listing slug shape sends every such listing to the per-request route
// (2026-11-21: all listings posted since Nov 5 ended in "-<8 hex>" and rendered on every visit).
const require = createRequire(import.meta.url);
const { pathToRegexp } = require("next/dist/compiled/path-to-regexp");

const rule = (await nextConfig.rewrites()).find((r) => r.destination === "/jobs/landing/:slug");
const toLanding = (slug) => pathToRegexp(rule.source, [], { strict: true, sensitive: false, delimiter: "/" }).test(`/jobs/${slug}`);

it("keeps every listing slug shape on the cached job page", () => {
  for (const slug of ["senior-llm-engineer-tts-f42ba172", "email-designer-c67c0e9a", "support-specialist-DEADBEEF", "old-style-abc1234567890123"]) {
    assert.equal(toLanding(slug), false, slug);
  }
});

it("still sends landing pages and hand-written slugs to the per-request route", () => {
  for (const slug of ["usa", "worldwide", "latin-america", "frontend", "customer-support", "ai-ml", "h1b", "latest", "entry-level", "uk-visa-sponsorship", "eu-blue-card", "salary-100k-usd", "hand-written-admin-slug"]) {
    assert.equal(toLanding(slug), true, slug);
  }
});
