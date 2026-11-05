import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LANDINGS,
  JOB_LANDINGS,
  FOOTER_LANDINGS,
  MIN_INDEXABLE,
  isLive,
  landingBySlug,
  landingApiPath,
  landingPagePath,
  landingPath,
  pageParam,
  relatedLandings,
} from "../app/lib/landing/catalogue.ts";
import {
  sitemapChunks,
  sitemapXml,
  sitemapIndexXml,
  lastmod,
} from "../app/lib/sitemapXml.ts";
describe("data-backed landing catalogue", () => {
  it("has unique region, role, combined and sponsorship pages", () => {
    const paths = LANDINGS.map(landingPath);
    assert.equal(new Set(paths).size, paths.length);
    for (const slug of [
      "usa",
      "uk",
      "europe",
      "worldwide",
      "software-engineer",
      "software-engineer/uk",
      "senior/product",
      "h1b",
      "h1b/software-engineer",
    ])
      assert.ok(landingBySlug("jobs", slug));
  });
  it("does not present company history as job sponsorship", () => {
    const h1b = landingBySlug("jobs", "h1b");
    assert.equal(h1b.query.visaSponsorship, "yes");
    assert.equal(h1b.query.visaType, "H1B");
    assert.equal(
      landingBySlug("jobs", "h1b/software-engineer").query.visaSponsorship,
      "yes",
    );
  });
  it("uses explicit worldwide eligibility and comparable base pay", () => {
    assert.equal(landingBySlug("jobs", "worldwide").query.worldwide, "1");
    const salary = landingBySlug("jobs", "salary-100k-usd").query;
    assert.deepEqual(
      [salary.salaryMin, salary.salaryCurrency, salary.salaryPeriod],
      ["100000", "USD", "year"],
    );
  });
  it("keeps unsupported education/distribution lists unavailable", () => {
    for (const slug of [
      "degree-required",
      "no-degree-required",
      "not-on-linkedin",
    ])
      assert.equal(isLive(landingBySlug("jobs", slug)), false);
    assert.equal(MIN_INDEXABLE, 5);
  });
  it("uses only live jobs and bounds navigation links", () => {
    for (const landing of JOB_LANDINGS)
      assert.match(landingApiPath(landing, 1), /^\/jobs\?.*\blive=1\b/);
    assert.equal(FOOTER_LANDINGS.Jobs.length, 12);
    assert.ok(
      relatedLandings(landingBySlug("jobs", "software-engineer/uk")).length <=
        12,
    );
  });
  it("preserves pagination and refuses invalid values", () => {
    const landing = landingBySlug("jobs", "software-engineer/uk");
    assert.equal(landingPagePath(landing, 1), "/jobs/software-engineer/uk");
    assert.equal(
      landingPagePath(landing, 2),
      "/jobs/software-engineer/uk?page=2",
    );
    assert.equal(pageParam(undefined), 1);
    for (const value of ["0", "-1", "2.5", "abc", ["1", "2"], "999999"])
      assert.equal(pageParam(value), null);
  });
});
describe("split sitemap XML", () => {
  it("escapes XML and omits fabricated modification dates", () => {
    const xml = sitemapXml([
      { url: "https://example.com/jobs/a?x=1&y=2" },
      { url: "https://example.com/jobs/b", lastModified: "2026-10-20" },
    ]);
    assert.ok(xml.includes("&amp;"));
    assert.equal((xml.match(/<lastmod>/g) || []).length, 1);
    assert.equal(lastmod("bad-date"), null);
  });
  it("splits well below the 50000 URL ceiling", () => {
    const rows = Array.from({ length: 10001 }, (_, i) => ({
      url: `https://example.com/jobs/${i}`,
    }));
    assert.deepEqual(
      sitemapChunks(rows).map((c) => c.length),
      [10000, 1],
    );
    assert.ok(
      sitemapIndexXml(["https://example.com/sitemaps/jobs-0.xml"]).includes(
        "<sitemapindex",
      ),
    );
  });
});
