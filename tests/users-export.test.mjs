// The admin users screen's Export (/heroshima/users): ticking people across pages, Gmail's
// "Select all N", what the export action is sent, and the CSV / TXT the browser downloads
// (app/lib/tracking/export.ts). The server action (libs/analytics-admin.ts) imports next/headers,
// so it is checked in its source: it refuses a non-admin first and posts to the export route.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as waitlist-admin.test.mjs.

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

const { EXPORT_FIELDS, EXPORT_FIELD_GROUPS, NO_PICK, buildUserExport, exportCell, exportFileName, nextPick, parsePick, pickView, selectionOf } = await import(
  "../app/lib/tracking/export.ts"
);

const id = (n) => n.toString(16).padStart(24, "0");
const PAGE1 = [id(1), id(2), id(3)];
const PAGE2 = [id(4), id(5)];
const TOTAL = 5;

const act = (state, action, page = PAGE1, q = "", total = TOTAL) => nextPick(state, action, page, q, total);

describe("picking people", () => {
  it("keeps rows ticked on one page while another page is ticked", () => {
    let s = act(NO_PICK, { type: "row", id: id(2) });
    s = act(s, { type: "row", id: id(4) }, PAGE2);
    assert.deepEqual(s.picked.sort(), [id(2), id(4)]);
    assert.equal(pickView(s, PAGE1, "", TOTAL).count, 2);
    assert.deepEqual([...pickView(s, PAGE2, "", TOTAL).checked], [id(4)]);
  });

  it("ticks and unticks the whole page from the header box", () => {
    let s = act(NO_PICK, { type: "page" });
    assert.equal(pickView(s, PAGE1, "", TOTAL).allOnPage, true);
    s = act(s, { type: "page" });
    assert.deepEqual(s.picked, []);
  });

  it("offers Select all only once the page is full and more exist", () => {
    assert.equal(pickView(act(NO_PICK, { type: "row", id: id(1) }), PAGE1, "", TOTAL).offerEvery, false);
    assert.equal(pickView(act(NO_PICK, { type: "page" }), PAGE1, "", TOTAL).offerEvery, true);
    assert.equal(pickView(act(NO_PICK, { type: "page" }, PAGE1, "", 3), PAGE1, "", 3).offerEvery, false);
  });

  it("everyone, less the rows unticked after", () => {
    let s = act(act(NO_PICK, { type: "page" }), { type: "every" });
    assert.equal(pickView(s, PAGE2, "", TOTAL).count, 5);
    assert.equal(pickView(s, PAGE2, "", TOTAL).allOnPage, true);
    s = act(s, { type: "row", id: id(5) }, PAGE2);
    const view = pickView(s, PAGE2, "", TOTAL);
    assert.equal(view.every, true);
    assert.equal(view.count, 4);
    assert.deepEqual(selectionOf(s), { mode: "all", q: "", except: [id(5)] });
    s = act(s, { type: "row", id: id(5) }, PAGE2);
    assert.deepEqual(selectionOf(s), { mode: "all", q: "", except: [] });
  });

  it("an everyone-pick belongs to its search", () => {
    const s = act(act(NO_PICK, { type: "page" }, PAGE1, "ann"), { type: "every" }, PAGE1, "ann");
    assert.equal(pickView(s, PAGE1, "ann", TOTAL).count, 5);
    const other = pickView(s, PAGE1, "bob", 2);
    assert.equal(other.count, 0);
    assert.equal(other.every, false);
  });

  it("ticked one by one goes as ids", () => {
    assert.deepEqual(selectionOf(act(NO_PICK, { type: "row", id: id(3) })), { mode: "ids", ids: [id(3)] });
  });

  it("reads back only a real pick from storage", () => {
    assert.deepEqual(parsePick(null), NO_PICK);
    assert.deepEqual(parsePick("not json"), NO_PICK);
    assert.deepEqual(parsePick(JSON.stringify({ picked: [id(1), "../../x", 5, id(1)] })), { picked: [id(1)], every: null });
    assert.deepEqual(parsePick(JSON.stringify({ every: { q: "a", except: [id(2), "nope"] } })), { picked: [], every: { q: "a", except: [id(2)] } });
  });
});

describe("the file", () => {
  const data = {
    fields: ["name", "email", "tier", "createdAt", "verified", "creditBalance"],
    rows: [
      { name: "Ada, Countess", email: "ada@example.com", tier: "pro", createdAt: "2026-11-06T14:03:22.000Z", verified: true, creditBalance: 12 },
      { name: '=HYPERLINK("x")', email: null, tier: "free", createdAt: null, verified: false, creditBalance: -3 },
    ],
  };

  it("CSV: BOM, header, quoting, CRLF, formula text defused, numbers left alone", () => {
    const text = buildUserExport(data, "csv");
    assert.ok(text.startsWith("﻿"));
    const lines = text.slice(1).split("\r\n");
    assert.equal(lines[0], "Name,Email,Plan,Joined (UTC),Email verified,Credits left");
    assert.equal(lines[1], '"Ada, Countess",ada@example.com,Pro,2026-11-06 14:03,Yes,12');
    assert.equal(lines[2], `"'=HYPERLINK(""x"")",,Free,,No,-3`);
    assert.equal(lines[3], "");
  });

  it("TXT: tab separated, one line each, no header when asked", () => {
    const text = buildUserExport({ fields: ["name", "email"], rows: [{ name: "Line\nbreak\tname", email: "a@b.co" }] }, "txt", false);
    assert.equal(text, "Line break name\ta@b.co\n");
  });

  it("a single field gives a plain list", () => {
    const text = buildUserExport({ fields: ["email"], rows: [{ email: "a@b.co" }, { email: "c@d.co" }] }, "txt", false);
    assert.equal(text, "a@b.co\nc@d.co\n");
  });

  it("cells", () => {
    assert.equal(exportCell("tier", "ultra"), "Ultra");
    assert.equal(exportCell("emailOffers", true), "Yes");
    assert.equal(exportCell("phone", null), "");
    assert.equal(exportFileName("csv", new Date("2026-11-06T10:00:00Z")), "rww-users-2026-11-06.csv");
  });

  it("every field sits in exactly one group, and the backend offers the same keys", () => {
    const grouped = EXPORT_FIELD_GROUPS.flatMap((g) => g.fields);
    assert.deepEqual([...grouped].sort(), [...EXPORT_FIELDS].sort());
    const backendPath = new URL("../remoteworldwidebackend/src/services/admin/analyticsService.ts", ROOT);
    if (existsSync(fileURLToPath(backendPath))) {
      const source = readFileSync(backendPath, "utf8");
      const block = source.match(/export const EXPORT_FIELDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
      assert.deepEqual([...block.matchAll(/"(\w+)"/g)].map((m) => m[1]), [...EXPORT_FIELDS]);
    }
  });
});

describe("the server action", () => {
  it("refuses a non-admin first and posts to the export route", () => {
    const source = readFileSync(new URL("libs/analytics-admin.ts", ROOT), "utf8");
    const body = source.slice(source.indexOf("export const exportUsers"));
    assert.match(body, /=> \{\s*await requireAdminAction\(\);/);
    assert.match(body, /analytics<UserExport>\("\/users\/export", \{ method: "POST", body \}\)/);
  });
});
