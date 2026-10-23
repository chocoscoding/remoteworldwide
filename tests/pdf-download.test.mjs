// "Download as PDF" through the server renderer, the dialog only as the fallback (owner,
// 2026-10-22, PHASE6-OPEN-ITEMS-PLAN.md item I): which address a download asks, when it falls back,
// and that an apply draft is drawn as the step's paper draws it.
//
//   npm test        (node --test --experimental-strip-types tests/)

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

process.env.PRINT_TOKEN_SECRET = "test-secret-".padEnd(48, "x");

const { serverPdfPath, fetchServerPdf, downloadPdf } = await import("../app/lib/export/pdf-download.ts");
const { draftPaper } = await import("../app/lib/print/draft-paper.ts");
const { mintPrintToken, verifyPrintToken } = await import("../app/lib/print/token.ts");

const ID = "65c8e1d3b2c3d4e5f6071829";
const USER = "64b7f0c2a1b2c3d4e5f60718";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n% test\n");

const pdfResponse = (bytes = PDF_BYTES, type = "application/pdf") => new Response(bytes, { status: 200, headers: { "content-type": type } });
const htmlResponse = (status) => new Response("<p>no</p>", { status, headers: { "content-type": "text/html; charset=utf-8" } });

describe("serverPdfPath", () => {
  it("names a built resume and a letter by id", () => {
    assert.equal(serverPdfPath({ kind: "resume", id: ID }), `/open/resume/${ID}?to=pdf`);
    assert.equal(serverPdfPath({ kind: "letter", id: ID }), `/open/letter/${ID}?to=pdf`);
  });

  it("names a draft with the version the page shows", () => {
    assert.equal(serverPdfPath({ kind: "draft", id: ID, version: 4 }), `/open/draft/${ID}?to=pdf&v=4`);
  });

  it("names nothing it cannot print: no source, a bad id, a draft with no saved version", () => {
    assert.equal(serverPdfPath(null), null);
    assert.equal(serverPdfPath(undefined), null);
    assert.equal(serverPdfPath({ kind: "resume", id: "local-123" }), null);
    assert.equal(serverPdfPath({ kind: "resume", id: "../x" }), null);
    // An undo still being saved carries a provisional, negative version.
    assert.equal(serverPdfPath({ kind: "draft", id: ID, version: -1 }), null);
    assert.equal(serverPdfPath({ kind: "draft", id: ID, version: 0 }), null);
    assert.equal(serverPdfPath({ kind: "draft", id: ID, version: null }), null);
    assert.equal(serverPdfPath({ kind: "draft", id: ID }), null);
    assert.equal(serverPdfPath({ kind: "draft", id: ID, version: 1.5 }), null);
  });
});

describe("fetchServerPdf", () => {
  it("returns the PDF the server sends", async () => {
    const blob = await fetchServerPdf("/x", async () => pdfResponse());
    assert.ok(blob);
    assert.equal(new TextDecoder().decode(await blob.arrayBuffer()).slice(0, 5), "%PDF-");
  });

  it("sends the session cookie and asks for no cached copy", async () => {
    let seen;
    await fetchServerPdf("/x", async (_url, init) => {
      seen = init;
      return pdfResponse();
    });
    assert.equal(seen.credentials, "same-origin");
    assert.equal(seen.cache, "no-store");
  });

  it("is null for every answer that is not a PDF", async () => {
    for (const status of [409, 413, 429, 502, 503]) assert.equal(await fetchServerPdf("/x", async () => htmlResponse(status)), null);
    assert.equal(await fetchServerPdf("/x", async () => htmlResponse(200)), null);
    assert.equal(await fetchServerPdf("/x", async () => pdfResponse(new TextEncoder().encode("<html>"), "application/pdf")), null);
    assert.equal(await fetchServerPdf("/x", async () => { throw new TypeError("offline"); }), null);
  });

  it("gives up after its timeout", async () => {
    const hang = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    assert.equal(await fetchServerPdf("/x", hang, 20), null);
  });
});

describe("downloadPdf", () => {
  const run = async ({ source, respond }) => {
    const saved = [];
    const asked = [];
    let dialog = 0;
    const result = await downloadPdf({
      source,
      fileName: "Ada-Obi-Resume",
      save: (blob, name) => saved.push({ blob, name }),
      fallback: () => {
        dialog += 1;
      },
      fetchImpl: async (url, init) => {
        asked.push(url);
        return respond(url, init);
      },
    });
    return { result, saved, asked, dialog };
  };

  it("saves the server's PDF and never opens the dialog", async () => {
    const out = await run({ source: { kind: "draft", id: ID, version: 3 }, respond: () => pdfResponse() });
    assert.equal(out.result, "server");
    assert.deepEqual(out.asked, [`/open/draft/${ID}?to=pdf&v=3`]);
    assert.equal(out.saved.length, 1);
    assert.equal(out.saved[0].name, "Ada-Obi-Resume.pdf");
    assert.equal(out.dialog, 0);
  });

  it("opens the dialog when the renderer is off or failing, and saves nothing", async () => {
    for (const status of [503, 502, 429, 409]) {
      const out = await run({ source: { kind: "resume", id: ID }, respond: () => htmlResponse(status) });
      assert.equal(out.result, "dialog");
      assert.equal(out.saved.length, 0);
      assert.equal(out.dialog, 1);
    }
  });

  it("goes straight to the dialog, asking nothing, when there is no saved document to name", async () => {
    for (const source of [null, { kind: "draft", id: ID, version: -2 }, { kind: "resume", id: "unsaved" }]) {
      const out = await run({ source, respond: () => pdfResponse() });
      assert.equal(out.result, "dialog");
      assert.deepEqual(out.asked, []);
      assert.equal(out.dialog, 1);
    }
  });
});

describe("the draft print token", () => {
  it("is minted and verified for a draft, and opens no other kind", () => {
    const token = mintPrintToken({ userId: USER, kind: "draft", id: ID });
    assert.equal(verifyPrintToken(token, { kind: "draft", id: ID })?.k, "draft");
    assert.equal(verifyPrintToken(token, { kind: "resume", id: ID }), null);
    const resume = mintPrintToken({ userId: USER, kind: "resume", id: ID });
    assert.equal(verifyPrintToken(resume, { kind: "draft", id: ID }), null);
  });
});

describe("draftPaper", () => {
  const content = {
    name: "Ada Obi",
    title: "QA Lead",
    email: "ada@example.com",
    phone: "",
    location: "Lagos",
    links: [],
    summary: "Tests things.",
    skills: ["Playwright"],
    experience: [
      { id: "e1", role: "QA Lead", company: "Acme", location: "", startDate: "2022", endDate: "", current: true, bullets: ["Kept", "Hidden line"] },
      { id: "e2", role: "Tester", company: "Old Co", location: "", startDate: "2019", endDate: "2021", current: false, bullets: ["Gone"] },
    ],
    education: [],
    projects: [],
    certifications: [],
    hiddenParts: ["summary", "exp:e2", "exp:e1:1"],
  };

  it("leaves the hidden parts off, as the step's download always did", () => {
    const paper = draftPaper(content);
    assert.equal(paper.content.summary, "");
    assert.deepEqual(paper.content.experience.map((entry) => entry.id), ["e1"]);
    assert.deepEqual(paper.content.experience[0].bullets, ["Kept"]);
    assert.deepEqual(paper.content.hiddenParts, []);
  });

  it("draws the creator's default look, with sections for what the resume holds", () => {
    const paper = draftPaper(content);
    assert.ok(paper.design && paper.design.doc && paper.design.chrome !== undefined);
    assert.ok(Array.isArray(paper.sections) && paper.sections.length > 0);
  });
});
