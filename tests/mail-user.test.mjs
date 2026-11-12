// The mail system's site half for one person (MAIL-BUILD-SPEC.md sections 2, 7, 8): the tracker
// sends a mail's id (`m`, exactly 24 hex) with a page view and nothing else from the query string;
// the billing screen's personal offer reads the backend's labels and only rides on a checkout it
// covers; the admin's mail reads go through admin-guarded server actions; the public pages are
// noindex; and the browser-facing mail routes reach the backend through the narrow rewrites.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as tracking-ads.test.mjs.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, describe, it } from "node:test";
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

const { mailSendIdFrom, track, flush } = await import("../app/lib/tracking/tracker.ts");
const { MAIL_LEVELS, isOfferToken, offerCovers, offerHeadline, usableGrant, shortLink, feedbackQuestion, isFeedbackAnswer } = await import("../app/lib/mail/userMail.ts");

const { NO_PICK, nextPick, pickView, selectionOf, parsePick, exportCell } = await import("../app/lib/tracking/export.ts");

const site = (path) => readFileSync(fileURLToPath(new URL(path, ROOT)), "utf8");
const SEND = "65a1b2c3d4e5f60718293a4b";

describe("tracker: the mail a visit came from", () => {
  it("reads `m` only when it is exactly 24 hex characters", () => {
    assert.equal(mailSendIdFrom(`?m=${SEND}`), SEND);
    assert.equal(mailSendIdFrom(`?utm_source=email&m=${SEND.toUpperCase()}&utm_medium=campaign`), SEND);
    assert.equal(mailSendIdFrom(`?m=${SEND}0`), null);
    assert.equal(mailSendIdFrom(`?m=${SEND.slice(1)}`), null);
    assert.equal(mailSendIdFrom("?m=zza1b2c3d4e5f60718293a4b"), null);
    assert.equal(mailSendIdFrom("?m="), null);
    assert.equal(mailSendIdFrom(""), null);
    assert.equal(mailSendIdFrom("?email=someone%40example.com"), null);
  });

  describe("on the events it queues", () => {
    let sent;
    const realWindow = globalThis.window;
    const realFetch = globalThis.fetch;

    const visit = (search) => {
      globalThis.window = { location: { pathname: "/dashboard/resume", search }, setTimeout: () => 1, clearTimeout: () => {} };
    };
    const posted = () => {
      flush();
      return sent.flatMap((body) => JSON.parse(body).events);
    };

    beforeEach(() => {
      sent = [];
      globalThis.fetch = async (_url, init) => {
        sent.push(init.body);
        return new Response("{}");
      };
    });
    afterEach(() => {
      globalThis.window = realWindow;
      globalThis.fetch = realFetch;
    });

    it("adds `m` to a page view, and nothing else from the address", () => {
      visit(`?m=${SEND}&token=secret&email=a%40b.c`);
      track("page_view", "/dashboard/resume", { referrer: "https://mail.google.com/" });
      const [event] = posted();
      assert.deepEqual(event.props, { referrer: "https://mail.google.com/", m: SEND });
      assert.equal(event.path, "/dashboard/resume");
      assert.doesNotMatch(JSON.stringify(event), /secret|a@b\.c|token|email/);
    });

    it("leaves presses and pages without a mail id as they were", () => {
      visit(`?m=${SEND}`);
      track("click", "Upgrade", { tag: "button" });
      visit("?m=not-a-send-id&q=remote");
      track("page_view", "/jobs");
      const [press, page] = posted();
      assert.deepEqual(press.props, { tag: "button" });
      assert.equal(page.props, undefined);
    });
  });
});

describe("billing: the personal offer", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const grant = { code: "SAVE20", discountLabel: "20%", expiresAt: "2026-11-13T12:00:00Z", plans: ["pro"], intervals: ["month"], durationLabel: "your first month" };

  it("takes only the signed token shape from the address", () => {
    assert.ok(isOfferToken(`${SEND}.abcdEFGH_ijkl-mnop1234`));
    assert.ok(!isOfferToken(SEND));
    assert.ok(!isOfferToken(`${SEND}.short`));
    assert.ok(!isOfferToken(`${SEND}.abcd efgh ijkl mnop`));
    assert.ok(!isOfferToken(undefined));
  });

  it("shows nothing without a live grant", () => {
    assert.equal(usableGrant(null, now), null);
    assert.equal(usableGrant({ ...grant, expiresAt: "2026-11-10T11:59:00Z" }, now), null);
    assert.equal(usableGrant({ ...grant, discountLabel: "" }, now), null);
    assert.deepEqual(usableGrant(grant, now), grant);
  });

  it("words the banner from the backend's labels", () => {
    assert.equal(offerHeadline(grant), "20% off your first month");
    assert.equal(offerHeadline({ discountLabel: "$5", durationLabel: "first 3 months" }), "$5 off your first 3 months");
    assert.equal(offerHeadline({ discountLabel: "20%", durationLabel: "every payment" }), "20% off every payment");
    assert.equal(offerHeadline({ discountLabel: "20%", durationLabel: "" }), "20% off");
  });

  it("rides only on a checkout it covers", () => {
    assert.ok(offerCovers(grant, "pro", "month"));
    assert.ok(!offerCovers(grant, "ultra", "month"));
    assert.ok(!offerCovers(grant, "pro", "year"));
    assert.ok(offerCovers({ ...grant, plans: [], intervals: [] }, "basic", "quarter"));
  });

  it("is sent with the plan checkout and nothing else about it changes", () => {
    const mutation = site("hooks/mutations/useBillingMutations.ts");
    assert.match(mutation, /apiPost<Checkout>\("\/api\/billing\/checkout\/plan", \{ planKey, interval, \.\.\.\(offerToken \? \{ offerToken \} : \{\}\) \}\)/);
    const client = site("app/(pages)/(dashboard)/dashboard/settings/billing/Client.tsx");
    assert.match(client, /apiGet<CurrentOffer>\(`\/api\/mail\/offers\/current\?token=\$\{encodeURIComponent\(offerToken\)\}`\)/);
  });
});

describe("admin: one person's mail", () => {
  it("knows the five engagement levels", () => {
    assert.deepEqual([...MAIL_LEVELS], ["engaged", "reading", "quiet", "unreachable", "none"]);
  });

  it("reads mail through server actions that require an admin", () => {
    const source = site("libs/analytics-admin.ts");
    for (const name of ["getUserMail", "getUserMailEvents"]) {
      const body = source.slice(source.indexOf(`export const ${name} = async`));
      assert.match(body.slice(0, 300), /await requireAdminAction\(\);/);
    }
    assert.match(source, /\/admin\/mail\/analytics\$\{path\}/);
  });

  it("scopes the users list's Select all to the mail level, and exports it with the level", () => {
    const page = ["65a1b2c3d4e5f60718293a01", "65a1b2c3d4e5f60718293a02"];
    const every = nextPick(NO_PICK, { type: "every" }, page, "", 40, "engaged");
    assert.deepEqual(selectionOf(every), { mode: "all", q: "", mail: "engaged", except: [] });
    assert.equal(pickView(every, page, "", 40, "engaged").count, 40);
    assert.equal(pickView(every, page, "", 900, "").count, 0, "a different level reads as nothing picked");
    const unticked = nextPick(every, { type: "row", id: page[0] }, page, "", 40, "engaged");
    assert.deepEqual(selectionOf(unticked), { mode: "all", q: "", mail: "engaged", except: [page[0]] });
    assert.deepEqual(parsePick(JSON.stringify(unticked)), unticked);
    assert.deepEqual(selectionOf(nextPick(NO_PICK, { type: "every" }, page, "ann", 3)), { mode: "all", q: "ann", except: [] });
    assert.equal(exportCell("mailLevel", "none"), "Never mailed");
  });

  it("shows our links as paths without their tags", () => {
    assert.equal(shortLink(`https://www.remoteworldwide.net/dashboard/resume?m=${SEND}&utm_source=email`), "/dashboard/resume");
    assert.equal(shortLink("https://example.com/post"), "example.com/post");
  });
});

describe("public mail pages", () => {
  it("ask the right follow-up for each answer", () => {
    assert.equal(feedbackQuestion("great"), "What do you like most?");
    assert.equal(feedbackQuestion("bad"), "What should we fix first?");
    assert.ok(isFeedbackAnswer("yes") && !isFeedbackAnswer("maybe"));
  });

  it("are not indexed and carry no em dashes", () => {
    for (const file of [
      "app/(pages)/(general)/mail/feedback/page.tsx",
      "app/(pages)/(general)/mail/feedback/FeedbackComment.tsx",
      "app/(pages)/(general)/mail/unsubscribed/page.tsx",
      "app/(pages)/(general)/mail/unsubscribed/UnsubscribeReason.tsx",
    ]) {
      const source = site(file);
      if (file.endsWith("page.tsx")) assert.match(source, /robots: \{ index: false, follow: false \}/, file);
      assert.doesNotMatch(source, new RegExp(String.fromCharCode(0x2014)), `${file} has an em dash`);
    }
  });

  it("reach the backend through narrow rewrites", () => {
    const config = site("next.config.mjs");
    for (const path of ["/api/mail/feedback", "/api/mail/feedback/comment", "/api/mail/unsubscribe-reason", "/api/mail/offers/current"]) {
      assert.match(config, new RegExp(`source: "${path}",\\s+destination: \`\\$\\{backend\\}${path}\``), path);
    }
    assert.doesNotMatch(config, /source: "\/api\/mail\/:path\*"/);
  });
});
