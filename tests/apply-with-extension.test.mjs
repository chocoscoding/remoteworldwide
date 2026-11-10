import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPrompt } from "../app/lib/extension/pendingApply.ts";

// What a job page's Apply now asks on desktop Chrome (owner, 2026-11-09: "check if they have the
// extension and if it's currently working"). The extension works from the site's own sign-in.
describe("Apply now's question", () => {
  it("asks to install the extension when it is not here, signed in or not", () => {
    for (const account of ["loading", "signed-in", "signed-out"]) assert.equal(applyPrompt("absent", account), "install");
  });

  it("asks a signed-out visitor who has the extension to sign in, since it cannot fill anything yet", () => {
    assert.equal(applyPrompt("installed", "signed-out"), "sign-in");
  });

  it("is the plain link when the extension is here and someone is signed in", () => {
    assert.equal(applyPrompt("installed", "signed-in"), null);
  });

  it("has no answer while the extension check or the session is still coming, so a click waits", () => {
    for (const account of ["loading", "signed-in", "signed-out"]) assert.equal(applyPrompt("checking", account), undefined);
    assert.equal(applyPrompt("installed", "loading"), undefined);
  });
});
