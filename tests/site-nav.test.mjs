import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JOB_BROWSE } from "../app/lib/navigation/siteNav.ts";
import { landingBySlug } from "../app/lib/landing/catalogue.ts";

// The navbar spells its region and role links out (so it does not ship the whole landing catalogue
// to every page); this keeps them pointing at pages that exist.
describe("navbar region and role links", () => {
  it("each opens a landing page in the catalogue", () => {
    for (const section of JOB_BROWSE) {
      for (const link of section.links) {
        const slug = link.href.replace(/^\/jobs\//, "");
        assert.ok(link.href.startsWith("/jobs/"), `${link.title}: ${link.href} is not under /jobs/`);
        assert.ok(landingBySlug("jobs", slug), `${link.title}: /jobs/${slug} is not a landing page`);
      }
    }
  });

  it("lists each page once", () => {
    const hrefs = JOB_BROWSE.flatMap((section) => section.links.map((link) => link.href));
    assert.equal(new Set(hrefs).size, hrefs.length);
  });
});
