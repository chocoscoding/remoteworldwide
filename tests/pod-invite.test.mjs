// Pod invite links (app/lib/dashboard/pod-invite.ts): the link people share is the public invite
// page, `/pod/<code>`, which previews as a pod invite; the join itself happens on the pod screen.
// Whatever someone pastes, the new page's link, an older `?join=` link or the bare code, still
// gives back the code.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// The module imports nothing, so no resolve hook is needed.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { extractInviteCode, generateInviteCode, inviteUrl, joinHref } = await import("../app/lib/dashboard/pod-invite.ts");

const code = generateInviteCode();

describe("pod invite links", () => {
  it("shares the public invite page, and joins on the pod screen", () => {
    assert.equal(inviteUrl(code, "https://www.remoteworldwide.net"), `https://www.remoteworldwide.net/pod/${code}`);
    assert.equal(joinHref(code), `/dashboard/pod?join=${code}`);
  });

  it("reads the code back from the invite page's link, an older join link, or the bare code", () => {
    assert.equal(extractInviteCode(inviteUrl(code, "https://www.remoteworldwide.net")), code);
    assert.equal(extractInviteCode(`https://www.remoteworldwide.net/pod/${code}/`), code);
    assert.equal(extractInviteCode(`https://www.remoteworldwide.net/dashboard/pod?join=${code}`), code);
    assert.equal(extractInviteCode(code.toLowerCase().match(/.{1,6}/g).join("-")), code);
  });

  it("finds no code in a link to anywhere else", () => {
    assert.equal(extractInviteCode(`https://www.remoteworldwide.net/jobs/${code}`), null);
    assert.equal(extractInviteCode("https://www.remoteworldwide.net/pod/short"), null);
  });
});
