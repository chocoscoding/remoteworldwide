// My documents as one list (app/lib/documents/library.ts): uploaded files and
// the resumes and cover letters made here, under All / Resumes / Cover letters
// / Others / Archived; Edit only for what was made here; the editors' "See all"
// tab links.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as print.test.mjs: Node resolves neither the `@/` alias nor an
// extensionless `./x`, so the hook maps them the way tsconfig does. The module
// under test imports types only, which is part of what this checks.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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

const { createdFileHref, editHref, inTab, libraryItems, tabCounts, tabFromParam } = await import("../app/lib/documents/library.ts");

const file = (id, kind, extra = {}) => ({ id, name: `${kind} file`, kind, source: "uploaded", addedAt: 1_000, updatedLabel: "Added 1 Oct", ...extra });
const resume = (id, extra = {}) => ({ id, label: `Resume ${id}`, template: null, jobId: null, sourceDocumentId: null, archived: false, createdAt: new Date(0), updatedAt: new Date(2_000), ...extra });
const letter = (id, extra = {}) => ({ id, label: `Letter ${id}`, tone: null, jobId: null, archived: false, createdAt: new Date(0), updatedAt: new Date(3_000), ...extra });

const items = libraryItems(
  [file("f1", "resume"), file("f2", "cover-letter"), file("f3", "portfolio"), file("f4", "certificate", { archived: true })],
  [resume("r1"), resume("r2", { archived: true })],
  [letter("l1")],
);
const keysIn = (tab) => items.filter((item) => inTab(item, tab)).map((item) => item.key);

describe("one list, five tabs", () => {
  it("puts uploaded and made-here resumes together, and letters together", () => {
    assert.deepEqual(keysIn("resumes"), ["file:f1", "resume:r1"]);
    assert.deepEqual(keysIn("cover-letters"), ["file:f2", "cover-letter:l1"]);
  });

  it("keeps Others for whatever is neither, and Archived for the archived of every kind", () => {
    assert.deepEqual(keysIn("other"), ["file:f3"]);
    assert.deepEqual(keysIn("archived"), ["file:f4", "resume:r2"]);
    assert.equal(keysIn("all").length, 5);
  });

  it("counts each tab the same way", () => {
    assert.deepEqual(tabCounts(items), { all: 5, resumes: 2, "cover-letters": 2, other: 1, archived: 2 });
  });

  it("reads a service from before archiving as nothing archived", () => {
    const [old] = libraryItems([], [{ ...resume("r9"), archived: undefined }], []);
    assert.equal(old.archived, false);
  });

  it("dates a made-here document by when it was last worked on", () => {
    assert.equal(items.find((item) => item.key === "cover-letter:l1").at, 3_000);
  });
});

describe("what a row can do", () => {
  it("edits only what was made here, in its own editor", () => {
    assert.equal(editHref(items.find((item) => item.key === "resume:r1")), "/dashboard/resume?doc=r1");
    assert.equal(editHref(items.find((item) => item.key === "cover-letter:l1")), "/dashboard/cover?letter=l1");
    assert.equal(editHref(items.find((item) => item.key === "file:f1")), null);
  });

  it("downloads a made-here document through /open, the file the extension gets", () => {
    assert.equal(createdFileHref(items.find((item) => item.key === "resume:r1"), "pdf"), "/open/resume/r1?to=pdf");
    assert.equal(createdFileHref(items.find((item) => item.key === "cover-letter:l1"), "docx"), "/open/letter/l1?to=docx");
    assert.equal(createdFileHref(items.find((item) => item.key === "file:f2"), "pdf"), null);
  });
});

describe("the tab in the address", () => {
  it("opens the editors' See all links on their own tab, and anything else on All", () => {
    assert.equal(tabFromParam("resumes"), "resumes");
    assert.equal(tabFromParam("cover-letters"), "cover-letters");
    assert.equal(tabFromParam("junk"), "all");
    assert.equal(tabFromParam(null), "all");
  });
});
