// Activity tracking, ads and whole-page plan locks (owner, 2026-10-28).
//
// Checked here: the site's mirrors of the backend's contracts agree with it (track kinds, ad slots,
// where those repos are checked out beside this one); `ago` reads times the way the admin screens
// show them; the /jobs list has tall side slots and a bottom banner, and the AdSlot asks the
// backend rather than deciding who sees ads itself; the pages a lower plan has none of render the
// plan card instead of themselves; and the admin data goes only through admin-guarded server actions.
//
//   npm test        (node --test --experimental-strip-types tests/)

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    const isPath = target.startsWith(".") || target.startsWith("file:");
    if (isPath && !/\.[cm]?[jt]sx?$/.test(target)) {
      const base = new URL(target, context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(target, context);
  },
});

const { TRACK_KINDS, ago } = await import("../app/lib/tracking/types.ts");
const { AD_SLOTS, ADSENSE_UNITS, ADVERTISE_HREF, adsenseUnit } = await import("../app/lib/ads/types.ts");

const site = (path) => readFileSync(fileURLToPath(new URL(path, ROOT)), "utf8");
const BACKEND = fileURLToPath(new URL("../../remoteworldwidebackend/src/", import.meta.url));
const backend = (file) => readFileSync(`${BACKEND}${file}`, "utf8");
const listed = (source, name) => [...source.match(new RegExp(`${name} = \\[([^\\]]+)\\]`))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

describe("contracts with the backend", { skip: !existsSync(BACKEND) && "backend not checked out beside the site" }, () => {
  it("names the same event kinds", () => {
    assert.deepEqual([...TRACK_KINDS], listed(backend("types/tracking.ts"), "TRACK_KINDS"));
  });

  it("names the same ad slots", () => {
    assert.deepEqual([...AD_SLOTS], listed(backend("models/ad.model.ts"), "AD_SLOTS"));
  });
});

describe("ago", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  it("reads recent times in minutes, hours and days, and older ones as a date", () => {
    assert.equal(ago(null, now), "Never");
    assert.equal(ago("2026-10-28T11:59:40Z", now), "Just now");
    assert.equal(ago("2026-10-28T11:15:00Z", now), "45 min ago");
    assert.equal(ago("2026-10-28T07:00:00Z", now), "5 h ago");
    assert.equal(ago("2026-10-25T12:00:00Z", now), "3 d ago");
    assert.match(ago("2026-08-01T12:00:00Z", now), /2026/);
  });
});

describe("ads", () => {
  it("flank the jobs list with tall slots and put a banner under it, only for viewers who get ads", () => {
    const jobs = site("app/(pages)/(general)/jobs/Client.tsx");
    assert.match(jobs, /showAds \? <AdSlot slot="jobs-left" shape="tall"/);
    assert.match(jobs, /showAds \? <AdSlot slot="jobs-right" shape="tall"/);
    assert.match(jobs, /showAds \? <AdSlot slot="jobs-bottom" shape="banner"/);
    const job = site("app/components/main/job/JobPage.tsx");
    assert.match(job, /<AdSlot slot="job-sidebar" only="desktop"/);
    assert.match(job, /\{apply\(true\)\}\s*<AdSlot slot="job-bottom" shape="banner" only="mobile"/);
  });

  it("ask the backend for the slot, which decides who sees ads, and show a custom ad before Google", () => {
    const slot = site("app/components/main/AdSlot.tsx");
    assert.match(slot, /\/api\/ads\?slot=/);
    assert.match(slot, /if \(!answer\?\.show \|\| \(!ad && !unit && !preview\)\) return null;/);
    // The empty dashed box is a local-development aid only.
    assert.match(slot, /const preview = !ad && !unit && process\.env\.NODE_ENV === "development";/);
    assert.ok(slot.indexOf("{ad ? (") < slot.indexOf("<GoogleAd"), "a custom ad comes first");
    assert.match(slot, /rel="sponsored noopener noreferrer"/);
    assert.match(site("next.config.mjs"), /source: "\/api\/ads\/:path\*"/);
  });

  it("keep the 'Want your ads here?' email link ready but commented out", () => {
    const slot = site("app/components/main/AdSlot.tsx");
    assert.match(slot, /\{\/\*[^]*?<a href=\{ADVERTISE_HREF\}[^>]*text-left[^]*?Want your ads here\?[^]*?\*\/\}/);
    assert.match(ADVERTISE_HREF, /^mailto:contact@remoteworldwide\.net\?subject=/);
  });

  it("read the AdSense unit per slot, off without a publisher id", () => {
    assert.equal(adsenseUnit("jobs-left"), process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? ADSENSE_UNITS["jobs-left"] : null);
    for (const name of AD_SLOTS) assert.ok(name in ADSENSE_UNITS);
  });
});

describe("whole-page plan locks", () => {
  it("show the plan card instead of the pod and recommendations below their plan", () => {
    assert.match(site("app/components/dashboard/pod/PodLocked.tsx"), /<PlanPageLock\s+gate=\{BASIC_GATES\.pod\}/);
    for (const file of ["app/(pages)/(dashboard)/dashboard/recommend/Client.tsx", "app/(pages)/(dashboard)/dashboard/recommend/[id]/Client.tsx"]) {
      const source = site(file);
      assert.match(source, /if \(lock\.locked && !holdsPriorityIntro\(gifts\)\) \{\s+return \(\s+<PlanPageLock/);
    }
  });
});

describe("admin analytics and ads", () => {
  it("go only through server actions that require an admin", () => {
    for (const file of ["libs/analytics-admin.ts", "libs/ads-admin.ts"]) {
      const source = site(file);
      assert.match(source, /^"use server";/);
      const exported = [...source.matchAll(/export const (\w+) = async/g)].map((m) => m[1]);
      assert.ok(exported.length > 0);
      for (const name of exported) {
        const body = source.slice(source.indexOf(`export const ${name} = async`));
        assert.match(body.slice(0, 400), /await requireAdminAction\(\);/, `${file} ${name} checks the admin`);
      }
    }
  });

  it("never send what was typed into a field", () => {
    const tracker = site("app/lib/tracking/tracker.ts");
    assert.doesNotMatch(tracker, /\.value\b/);
  });
});
