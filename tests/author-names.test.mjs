// A post's byline (app/lib/blog/authors.ts): one author alone, two joined with "&", three or more
// with commas and a final "&".
//
//   npm test        (node --test --experimental-strip-types tests/)

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAuthorNames } from "../app/lib/blog/authors.ts";

describe("formatAuthorNames", () => {
  it("leaves one name alone", () => {
    assert.equal(formatAuthorNames(["Ada"]), "Ada");
  });

  it("joins two with an ampersand", () => {
    assert.equal(formatAuthorNames(["Ada", "Grace"]), "Ada & Grace");
  });

  it("joins three or more with commas and a final ampersand", () => {
    assert.equal(formatAuthorNames(["Ada", "Grace", "Linus"]), "Ada, Grace & Linus");
    assert.equal(formatAuthorNames(["Ada", "Grace", "Linus", "Barbara"]), "Ada, Grace, Linus & Barbara");
  });

  it("drops blank names and answers an empty list with an empty string", () => {
    assert.equal(formatAuthorNames([]), "");
    assert.equal(formatAuthorNames(["Ada", " ", "Grace"]), "Ada & Grace");
  });
});
