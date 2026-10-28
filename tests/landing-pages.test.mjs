// The job and company landing pages (app/lib/landing/catalogue.ts, 2026-10-28).
//
// A page goes live only when the backend stores the data behind its filter; the rest answer 404 and
// stay out of the footer and the sitemap. Job lists ask the backend for live listings only. Every
// catalogue entry has its route folder, and that folder names its own slug.
//
//   npm test        (node --test --experimental-strip-types tests/)

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMPANY_LANDINGS,
  FOOTER_LANDINGS,
  JOB_LANDINGS,
  LANDINGS,
  isLive,
  landingApiPath,
  landingPagePath,
  landingPath,
  pageParam,
} from "../app/lib/landing/catalogue.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

describe("landing catalogue", () => {
  it("has the owner's nine job pages and three company pages, each at its own path", () => {
    assert.equal(JOB_LANDINGS.length, 9);
    assert.equal(COMPANY_LANDINGS.length, 3);
    const paths = LANDINGS.map(landingPath);
    assert.equal(new Set(paths).size, paths.length);
  });

  it("goes live only where the backend has the data: latest, entry level, frontend, Latin America and top companies", () => {
    assert.deepEqual(LANDINGS.filter(isLive).map(landingPath), ["/jobs/latest", "/jobs/entry-level", "/jobs/frontend-developer", "/jobs/latin-america", "/companies/top"]);
    for (const landing of LANDINGS.filter((l) => !isLive(l))) assert.ok(landing.missing && landing.missing.length > 20, landing.slug);
  });

  it("lists only live pages in the footer", () => {
    assert.deepEqual(FOOTER_LANDINGS.Jobs.map((l) => l.href), ["/jobs/latest", "/jobs/entry-level", "/jobs/frontend-developer", "/jobs/latin-america"]);
    assert.deepEqual(FOOTER_LANDINGS.Companies.map((l) => l.href), ["/companies/top"]);
  });

  it("asks the backend for live listings only, on every job page", () => {
    for (const landing of JOB_LANDINGS) assert.match(landingApiPath(landing, 1), /^\/jobs\?.*\blive=1\b/);
    assert.equal(landingApiPath(COMPANY_LANDINGS[0], 3), "/companies?sort=jobs&page=3");
  });

  it("gives page 1 no ?page and reads only whole page numbers", () => {
    assert.equal(landingPagePath(JOB_LANDINGS[0], 1), "/jobs/latest");
    assert.equal(landingPagePath(JOB_LANDINGS[0], 2), "/jobs/latest?page=2");
    assert.equal(pageParam(undefined), 1);
    assert.equal(pageParam("4"), 4);
    for (const bad of ["0", "-1", "2.5", "abc", ["1", "2"], "999999"]) assert.equal(pageParam(bad), null, String(bad));
  });

  it("keeps the copy free of em dashes and carries the site name in every title", () => {
    for (const landing of LANDINGS) {
      const words = [landing.name, landing.h1, landing.metaTitle, landing.metaDescription, ...landing.intro].join(" ");
      assert.ok(!words.includes("—"), landing.slug);
      assert.match(landing.metaTitle, /\| Remote Worldwide$/);
      assert.ok(landing.metaDescription.length <= 170, `${landing.slug} description is ${landing.metaDescription.length} chars`);
    }
  });

  it("has a route folder for every page, naming its own kind and slug", () => {
    for (const landing of LANDINGS) {
      const file = join(ROOT, "app", "(pages)", "(general)", landing.kind, landing.slug, "page.tsx");
      assert.ok(existsSync(file), file);
      const source = readFileSync(file, "utf8");
      assert.ok(source.includes(`landingMetadata("${landing.kind}", "${landing.slug}"`), file);
      assert.ok(source.includes(`kind="${landing.kind}" slug="${landing.slug}"`), file);
    }
  });
});
