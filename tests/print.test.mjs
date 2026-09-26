// The server-PDF building blocks that can be checked without a browser, a
// session or a network: the print token, the server's letter sanitiser, the
// font registry's parity with its next/font loaders, and the print CSS the
// browser export was already sending.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Plain `node --test` on the TypeScript as written, not a test framework: these
// modules are pure by design (token.ts needs only node:crypto, font-meta.ts and
// print-css.ts only types), and that purity is itself part of what is tested —
// if one of them grows an import Node cannot load, this file stops loading.
//
// Node resolves neither the `@/` alias nor an extensionless `./x`, both of which
// the app's own imports use; the hook below maps them, the way tsconfig does.

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

const SECRET = "test-secret-".padEnd(48, "x");
process.env.PRINT_TOKEN_SECRET = SECRET;

const { mintPrintToken, verifyPrintToken, PRINT_TOKEN_TTL_SECONDS } = await import("../app/lib/print/token.ts");
const { sanitizeLetterHtmlServer } = await import("../app/lib/export/letter-sanitize.ts");
const { FONT_REGISTRY, FONT_OPTIONS, SANS_FALLBACK, SERIF_FALLBACK } = await import("../app/lib/dashboard/resume/font-meta.ts");
const { printFrameCss, resumePrintSpec } = await import("../app/lib/export/print-css.ts");

const USER = "64b7f0c2a1b2c3d4e5f60718";
const DOC = "65c8e1d3b2c3d4e5f6071829";
const OTHER_DOC = "65c8e1d3b2c3d4e5f607182a";
const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);

describe("print token", () => {
  const token = mintPrintToken({ userId: USER, kind: "resume", id: DOC, now: NOW });

  it("verifies for the page it names, and says whose it is", () => {
    const payload = verifyPrintToken(token, { kind: "resume", id: DOC, now: NOW + 1_000 });
    assert.ok(payload);
    assert.equal(payload.u, USER);
    assert.equal(payload.k, "resume");
    assert.equal(payload.d, DOC);
    assert.equal(payload.v, 1);
    assert.equal(payload.exp, Math.floor(NOW / 1000) + PRINT_TOKEN_TTL_SECONDS);
    assert.ok(PRINT_TOKEN_TTL_SECONDS <= 120);
  });

  it("is refused when any byte of the payload or the signature changes", () => {
    const [body, signature] = token.split(".");
    const flip = (s, i) => s.slice(0, i) + (s[i] === "A" ? "B" : "A") + s.slice(i + 1);
    for (let i = 0; i < body.length; i += 7) assert.equal(verifyPrintToken(`${flip(body, i)}.${signature}`, { kind: "resume", id: DOC, now: NOW }), null);
    for (let i = 0; i < signature.length; i += 5) assert.equal(verifyPrintToken(`${body}.${flip(signature, i)}`, { kind: "resume", id: DOC, now: NOW }), null);
    // A payload re-signed by anyone without the secret: another user's id, same signature.
    const forged = Buffer.from(JSON.stringify({ u: "000000000000000000000000", k: "resume", d: DOC, v: 1, exp: Math.floor(NOW / 1000) + 60 })).toString("base64url");
    assert.equal(verifyPrintToken(`${forged}.${signature}`, { kind: "resume", id: DOC, now: NOW }), null);
    assert.equal(verifyPrintToken(`${body}.${signature}.x`, { kind: "resume", id: DOC, now: NOW }), null);
    assert.equal(verifyPrintToken("", { kind: "resume", id: DOC, now: NOW }), null);
    assert.equal(verifyPrintToken(null, { kind: "resume", id: DOC, now: NOW }), null);
  });

  it("expires", () => {
    assert.ok(verifyPrintToken(token, { kind: "resume", id: DOC, now: NOW + 119_000 }));
    assert.equal(verifyPrintToken(token, { kind: "resume", id: DOC, now: NOW + 120_000 }), null);
    assert.equal(verifyPrintToken(token, { kind: "resume", id: DOC, now: NOW + 3_600_000 }), null);
  });

  it("is refused for a token that claims a life longer than any it is minted with", () => {
    const fromTheFuture = mintPrintToken({ userId: USER, kind: "resume", id: DOC, now: NOW + 600_000 });
    assert.equal(verifyPrintToken(fromTheFuture, { kind: "resume", id: DOC, now: NOW }), null);
  });

  it("opens only the kind and the id it names", () => {
    assert.equal(verifyPrintToken(token, { kind: "letter", id: DOC, now: NOW }), null);
    assert.equal(verifyPrintToken(token, { kind: "resume", id: OTHER_DOC, now: NOW }), null);
  });

  it("is refused under a different secret, and cannot be minted or verified without one", () => {
    process.env.PRINT_TOKEN_SECRET = "another-secret-".padEnd(48, "y");
    assert.equal(verifyPrintToken(token, { kind: "resume", id: DOC, now: NOW }), null);
    process.env.PRINT_TOKEN_SECRET = "too-short";
    assert.throws(() => mintPrintToken({ userId: USER, kind: "resume", id: DOC, now: NOW }));
    assert.equal(verifyPrintToken(token, { kind: "resume", id: DOC, now: NOW }), null);
    delete process.env.PRINT_TOKEN_SECRET;
    assert.equal(verifyPrintToken(token, { kind: "resume", id: DOC, now: NOW }), null);
    process.env.PRINT_TOKEN_SECRET = SECRET;
    assert.ok(verifyPrintToken(token, { kind: "resume", id: DOC, now: NOW }));
  });

  it("refuses to mint for something that is not a user and a document", () => {
    assert.throws(() => mintPrintToken({ userId: "../../x", kind: "resume", id: DOC, now: NOW }));
    assert.throws(() => mintPrintToken({ userId: USER, kind: "resume", id: "../x", now: NOW }));
    assert.throws(() => mintPrintToken({ userId: USER, kind: "file", id: DOC, now: NOW }));
  });

  it("carries a letter's letterhead, signed, and only a letter's", () => {
    const letterhead = { name: "  Adé Okafor ", contact: ["ade@example.com", "", "Lagos"] };
    const letter = mintPrintToken({ userId: USER, kind: "letter", id: DOC, letterhead, now: NOW });
    const payload = verifyPrintToken(letter, { kind: "letter", id: DOC, now: NOW });
    assert.deepEqual(payload?.lh, { name: "Adé Okafor", contact: ["ade@example.com", "Lagos"] });
    const resume = mintPrintToken({ userId: USER, kind: "resume", id: DOC, letterhead, now: NOW });
    assert.equal(verifyPrintToken(resume, { kind: "resume", id: DOC, now: NOW })?.lh, undefined);
    // The renderer refuses a token past 2048 characters; a long profile is clamped under it.
    const long = mintPrintToken({ userId: USER, kind: "letter", id: DOC, letterhead: { name: "N".repeat(5000), contact: Array(20).fill("c".repeat(5000)) }, now: NOW });
    assert.ok(long.length <= 2048);
  });
});

describe("server letter sanitiser", () => {
  it("strips scripts, styles and handlers, and keeps the text", () => {
    const out = sanitizeLetterHtmlServer(
      `<p onclick="steal()">Dear team,<script>alert(document.cookie)</script></p><style>p{display:none}</style><img src=x onerror="alert(1)"><iframe src="https://evil.example">x</iframe><p style="color:red" class="c">Thanks</p>`,
    );
    assert.equal(out, "<p>Dear team,</p><p>Thanks</p>");
  });

  it("keeps http, https and mailto links, and unwraps every other one to its text", () => {
    const out = sanitizeLetterHtmlServer(
      `<p><a href="https://example.com/work?a=1&b=2" target="_blank" onclick="x()">portfolio</a> · <a href="mailto:ade@example.com">mail</a> · <a href="javascript:alert(1)">bad</a> · <a href="/relative">rel</a> · <a>bare</a></p>`,
    );
    assert.equal(out, `<p><a href="https://example.com/work?a=1&amp;b=2">portfolio</a> · <a href="mailto:ade@example.com">mail</a> · bad · rel · bare</p>`);
  });

  it("keeps the editor's formatting, turns wrappers into paragraphs, and leaves no stray tags", () => {
    const out = sanitizeLetterHtmlServer(`<div><b>Bold</b> <em>em</em> <u>u</u></div><ul><li>one</li></ul><a href="/x">x</a><br>tail <span>span</span> &lt;not a tag&gt;`);
    assert.equal(out, "<p><b>Bold</b> <em>em</em> <u>u</u></p><ul><li>one</li></ul>x<br />tail span &lt;not a tag&gt;");
  });
});

describe("font registry parity", () => {
  // Each loader in fonts.ts: `const x = Loader_Name({ … variable: "--r-f-…", … fallback: [ … ] });`
  const source = readFileSync(new URL("app/lib/dashboard/resume/fonts.ts", ROOT), "utf8");
  const loaders = [...source.matchAll(/const (\w+) = (\w+)\(\{([\s\S]*?)\}\);/g)].map(([, binding, loader, body]) => ({
    binding,
    loader,
    variable: /variable:\s*"([^"]+)"/.exec(body)?.[1],
    fallback: JSON.parse((/fallback:\s*(\[[^\]]*\])/.exec(body)?.[1] ?? "null").replace(/'/g, '"')),
  }));

  it("has one loader per registry face, with the same variable", () => {
    const registry = Object.values(FONT_REGISTRY);
    assert.equal(loaders.length, 12);
    assert.equal(registry.length, 12);
    assert.deepEqual(loaders.map((l) => l.variable).sort(), registry.map((f) => f.varName).sort());
  });

  it("names each face after its loader, and gives it the loader's fallback stack", () => {
    for (const face of Object.values(FONT_REGISTRY)) {
      const loader = loaders.find((l) => l.variable === face.varName);
      assert.ok(loader, face.id);
      assert.equal(loader.loader.replace(/_/g, " "), face.label, face.id);
      assert.deepEqual(loader.fallback, face.group === "serif" ? SERIF_FALLBACK : SANS_FALLBACK, face.id);
      assert.equal(face.fallback, loader.fallback.join(", "), face.id);
      assert.equal(face.previewClass, `font-[family-name:var(${face.varName})]`, face.id);
    }
  });

  it("puts every loader's variable class in ALL_FONT_VARS, and keeps the registry's order for the picker", () => {
    const all = /ALL_FONT_VARS: string = \[([\s\S]*?)\]\.join/.exec(source)?.[1] ?? "";
    for (const { binding } of loaders) assert.match(all, new RegExp(`\\b${binding}\\.variable\\b`), binding);
    assert.deepEqual(FONT_OPTIONS, Object.values(FONT_REGISTRY));
    assert.ok(/export \{ FONT_OPTIONS, FONT_REGISTRY, type FontDef \} from "\.\/font-meta";/.test(source), "fonts.ts re-exports the registry");
  });
});

describe("print CSS", () => {
  // What ResumeScreenBody and printDocument sent before the extraction, verbatim.
  it("is the browser export's, byte for byte", () => {
    assert.equal(
      printFrameCss("A4", "0"),
      "@page{size:A4;margin:0;}html,body{margin:0;padding:0;background:#fff;min-height:0;}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}",
    );
    const design = { doc: { pageFormat: "a4" }, spacing: { marginYmm: 14 } };
    assert.deepEqual(resumePrintSpec(design, false), {
      className: "rww-print",
      pageSize: "A4",
      pageMargin: "0",
      css: ".rww-print li{break-inside:avoid;}.rww-print [data-resume-page-break]{visibility:hidden;height:0;overflow:hidden;}",
    });
    assert.deepEqual(resumePrintSpec({ ...design, doc: { pageFormat: "letter" } }, true), {
      className: "rww-print rww-print-multi",
      pageSize: "Letter",
      pageMargin: "14mm 0",
      css:
        ".rww-print li{break-inside:avoid;}.rww-print [data-resume-page-break]{visibility:hidden;height:0;overflow:hidden;}" +
        ".rww-print-multi>*{min-height:0!important;padding-top:0!important;padding-bottom:0!important;}",
    });
  });
});
