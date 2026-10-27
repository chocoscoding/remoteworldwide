// Structured data inside <script type="application/ld+json"> (app/lib/seo.ts jsonLd).
//
// JSON.stringify escapes JSON, not HTML: a post title, an author's name or an author's "about"
// holding `</script>` would close the data script and start markup in a visitor's page. The MIME type
// does not stop the HTML parser seeing that delimiter. So every such script is written through
// jsonLd, which turns each `<` into the JSON escape <, at the final serialization boundary.
//
// The second half reads the real pages: a sink that goes back to JSON.stringify, or a new one that
// never used jsonLd, fails here, which a test of the helper alone would miss. The browser render of
// the Article and author page is separate (see the fix report): this repo has no JSX test runner.
//
//   npm test        (node --test --experimental-strip-types tests/)

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { jsonLd } from "../app/lib/seo.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const HOSTILE = '</script><img src=x onerror="window.__jsonLdMarker=1"><script>window.__jsonLdMarker=2</script>';

/** What an AUTHOR can type: their name and about, a post's title and description. */
const fixture = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: `Title ${HOSTILE}`,
  description: `Description </SCRIPT ><!-- ${HOSTILE}`,
  author: [{ "@type": "Person", name: `Name ${HOSTILE}`, description: `About <\/script> ${HOSTILE}` }],
};

describe("jsonLd", () => {
  it("leaves no literal less-than in the script body", () => {
    const body = jsonLd(fixture);
    assert.equal(body.includes("<"), false);
    assert.equal(/<\/script/i.test(body), false);
  });

  it("round-trips to exactly the original data", () => {
    assert.deepEqual(JSON.parse(jsonLd(fixture)), fixture);
    assert.deepEqual(JSON.parse(jsonLd([fixture, { name: "plain" }])), [fixture, { name: "plain" }]);
  });
});

const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name.startsWith(".") ? [] : sourceFiles(path);
    return /\.(tsx|ts)$/.test(name) ? [path] : [];
  });

/** Every <script type="application/ld+json" ...> element in the app, with what feeds its __html. */
const ldJsonSinks = () =>
  sourceFiles(join(ROOT, "app")).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    const found = [];
    for (const match of source.matchAll(/type=["']application\/ld\+json["'][\s\S]*?__html:\s*([^}]+?)\s*\}\}/g)) {
      found.push({ file: relative(ROOT, path).replaceAll("\\", "/"), html: match[1] });
    }
    return found;
  });

/** The constant-only organisation graph: no author, post or job text reaches it. */
const CONSTANT_ONLY = new Set(["app/components/SiteJsonLd.tsx"]);

describe("every application/ld+json sink", () => {
  const sinks = ldJsonSinks();

  it("is found, the blog's included", () => {
    const files = new Set(sinks.map((sink) => sink.file));
    for (const file of ["app/components/blog/Article.tsx", "app/(pages)/(general)/author/[id]/page.tsx", "app/(pages)/(general)/blogs/page.tsx", "app/(pages)/(general)/blogs/category/[slug]/page.tsx"]) {
      assert.ok(files.has(file), `no ld+json sink found in ${file}`);
    }
  });

  it("serializes through jsonLd, never JSON.stringify directly", () => {
    const raw = sinks.filter((sink) => !CONSTANT_ONLY.has(sink.file) && !/^(jsonLd|serializeJsonLd)\(/.test(sink.html));
    assert.deepEqual(raw, [], `ld+json written without the escaping serializer:\n${raw.map((s) => `  ${s.file}: ${s.html}`).join("\n")}`);
  });
});
