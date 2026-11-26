// When the site asks the backend who a request is (app/lib/auth/sessionLookup.ts, used by auth.ts).
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// The bug: auth() asked GET /api/auth/session on every render, /api/ai call and server action, so
// one busy person spent the backend's 1,000-per-15-minutes session budget and every lookup after
// that came back 429 ("[auth] session fetch failed: 429", 2026-11-25).
//
// And the other half (app/lib/auth/sessionEnded.ts): the backend stays the authority, so when it
// refuses a session the site forgets what it held and the browser signs out.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const { createSessionLookups, reusableSession, sessionCookieOf, SESSION_TTL_MS } = await import("../app/lib/auth/sessionLookup.ts");
const { createSessionWatch, sessionEnded, RECHECK_AFTER_MS } = await import("../app/lib/auth/sessionEnded.ts");
const { loginAfterSessionEnded, sessionEndedRedirect } = await import("../app/lib/next-url.ts");

const signedIn = (extra = {}) => ({ user: { id: "u1", email: "a@b.c", verified: true, deletionDueAt: null, ...extra }, expires: "2099-01-01" });

/** A backend double: counts its calls, answers what it is told, optionally after a wait. */
function backend(answer) {
  const calls = { count: 0 };
  const ask = async () => {
    calls.count += 1;
    return typeof answer === "function" ? answer() : answer;
  };
  return { ask, calls };
}

describe("sessionCookieOf", () => {
  it("finds nothing without an Auth.js session cookie, whatever else is there", () => {
    assert.equal(sessionCookieOf(null), null);
    assert.equal(sessionCookieOf(""), null);
    assert.equal(sessionCookieOf("_ga=GA1.1.123; theme=dark; authjs.csrf-token=abc"), null);
    assert.equal(sessionCookieOf("authjs.session-token="), null);
  });

  it("reads the plain and the __Secure- cookie", () => {
    assert.equal(sessionCookieOf("_ga=1; authjs.session-token=tok123"), "tok123");
    assert.equal(sessionCookieOf("__Secure-authjs.session-token=sec456; theme=dark"), "sec456");
  });

  it("joins a chunked token in chunk order", () => {
    assert.equal(sessionCookieOf("__Secure-authjs.session-token.1=BBB; x=1; __Secure-authjs.session-token.0=AAA"), "AAABBB");
  });

  it("keeps an = inside the value", () => {
    assert.equal(sessionCookieOf("authjs.session-token=ab=cd=="), "ab=cd==");
  });
});

describe("reusableSession", () => {
  it("reuses a signed-out answer and an ordinary signed-in one", () => {
    assert.equal(reusableSession(null), true);
    assert.equal(reusableSession(signedIn()), true);
    assert.equal(reusableSession(signedIn({ verified: undefined })), true);
  });

  it("never reuses a session waiting on something the person is about to change", () => {
    assert.equal(reusableSession(signedIn({ verified: false })), false);
    assert.equal(reusableSession(signedIn({ deletionDueAt: "2026-12-01T00:00:00.000Z" })), false);
  });
});

describe("createSessionLookups", () => {
  it("asks once for the same session within the window, then again after it", async () => {
    let clock = 1_000;
    const lookups = createSessionLookups({ now: () => clock });
    const { ask, calls } = backend({ session: signedIn(), reusable: true });

    assert.deepEqual((await lookups.lookup("tok", ask)).session, signedIn());
    clock += SESSION_TTL_MS - 1;
    assert.deepEqual((await lookups.lookup("tok", ask)).session, signedIn());
    assert.equal(calls.count, 1);

    clock += 2;
    await lookups.lookup("tok", ask);
    assert.equal(calls.count, 2);
  });

  it("folds lookups that start while one is in flight into that one", async () => {
    const lookups = createSessionLookups();
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const { ask, calls } = backend(async () => {
      await gate;
      return { session: signedIn(), reusable: true };
    });

    const burst = Promise.all([lookups.lookup("tok", ask), lookups.lookup("tok", ask), lookups.lookup("tok", ask)]);
    release();
    const answers = await burst;
    assert.equal(calls.count, 1);
    for (const answer of answers) assert.deepEqual(answer.session, signedIn());
  });

  it("keeps sessions apart: another cookie is another question", async () => {
    const lookups = createSessionLookups();
    const first = backend({ session: signedIn({ id: "u1" }), reusable: true });
    const second = backend({ session: signedIn({ id: "u2" }), reusable: true });
    assert.equal((await lookups.lookup("tok-1", first.ask)).session.user.id, "u1");
    assert.equal((await lookups.lookup("tok-2", second.ask)).session.user.id, "u2");
    assert.equal(first.calls.count + second.calls.count, 2);
  });

  it("never reuses a failed lookup: the next request asks again", async () => {
    const lookups = createSessionLookups();
    const { ask, calls } = backend({ session: null, reusable: false, failed: true });
    assert.equal((await lookups.lookup("tok", ask)).session, null);
    assert.equal((await lookups.lookup("tok", ask)).session, null);
    assert.equal(calls.count, 2);
    assert.equal(lookups.size(), 0);
  });

  it("says which null was a failure, so a 429 never reads as signed out", async () => {
    const lookups = createSessionLookups();
    const failing = backend({ session: null, reusable: true, failed: true });
    assert.equal((await lookups.lookup("tok", failing.ask)).failed, true);
    // Not held even if it claims to be reusable.
    assert.equal(lookups.size(), 0);

    const signedOut = backend({ session: null, reusable: true });
    assert.ok(!(await lookups.lookup("tok", signedOut.ask)).failed);
  });

  it("forgets a lookup that threw, and passes the error on", async () => {
    const lookups = createSessionLookups();
    const { ask, calls } = backend(() => {
      throw new Error("boom");
    });
    await assert.rejects(lookups.lookup("tok", ask), /boom/);
    await assert.rejects(lookups.lookup("tok", ask), /boom/);
    assert.equal(calls.count, 2);
  });

  it("forgets a held answer when the backend refuses the session, so the next lookup asks", async () => {
    const lookups = createSessionLookups();
    let answer = { session: signedIn(), reusable: true };
    const { ask, calls } = backend(() => answer);
    assert.deepEqual((await lookups.lookup("tok", ask)).session, signedIn());

    // Revoked from another device: a backend route answers 401 and the answer here is dropped.
    answer = { session: null, reusable: true };
    lookups.forget("tok");
    assert.equal((await lookups.lookup("tok", ask)).session, null);
    assert.equal(calls.count, 2);

    lookups.forget("never-held");
    assert.equal(lookups.size(), 1);
  });

  it("does not let a lookup in flight when its session was forgotten come back as held", async () => {
    const lookups = createSessionLookups();
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const { ask, calls } = backend(async () => {
      await gate;
      return { session: signedIn(), reusable: true };
    });
    const inFlight = lookups.lookup("tok", ask);
    lookups.forget("tok");
    release();
    await inFlight;
    assert.equal(lookups.size(), 0);
    await lookups.lookup("tok", ask);
    assert.equal(calls.count, 2);
  });

  it("holds no more than its cap, dropping the oldest answer first", async () => {
    const lookups = createSessionLookups({ maxEntries: 2 });
    const { ask, calls } = backend({ session: signedIn(), reusable: true });
    await lookups.lookup("a", ask);
    await lookups.lookup("b", ask);
    await lookups.lookup("c", ask);
    assert.equal(lookups.size(), 2);
    await lookups.lookup("c", ask);
    await lookups.lookup("b", ask);
    assert.equal(calls.count, 3);
    await lookups.lookup("a", ask);
    assert.equal(calls.count, 4);
  });
});

describe("sessionEnded: is the session really gone?", () => {
  const answering = (status, body) => async () => new Response(body === undefined ? "not json" : JSON.stringify(body), { status });

  it("says yes only for a clear signed-out answer from the backend", async () => {
    assert.equal(await sessionEnded(answering(200, null)), true);
    assert.equal(await sessionEnded(answering(200, {})), true);
    assert.equal(await sessionEnded(answering(200, signedIn())), false);
  });

  it("says no when it cannot tell: a refusal, a server fault, a network fault, a body it cannot read", async () => {
    assert.equal(await sessionEnded(answering(429, { message: "Too many requests" })), false);
    assert.equal(await sessionEnded(answering(503, {})), false);
    assert.equal(await sessionEnded(answering(200, undefined)), false);
    assert.equal(
      await sessionEnded(async () => {
        throw new TypeError("Failed to fetch");
      }),
      false,
    );
  });

  it("asks the backend's own session route on this origin", async () => {
    let asked;
    await sessionEnded(async (url, init) => {
      asked = { url, init };
      return new Response("null", { status: 200 });
    });
    assert.equal(asked.url, "/api/auth/session");
    assert.equal(asked.init.credentials, "same-origin");
    assert.equal(asked.init.cache, "no-store");
  });
});

describe("createSessionWatch: what a 401 in the browser does", () => {
  /** A watch with a fake clock, a fake "is it over?" answer, and a count of each. */
  function watch({ signedIn = true, over = true } = {}) {
    const state = { signedIn, over, clock: 0, checks: 0, signOuts: 0 };
    let release = () => {};
    const onRefused = createSessionWatch({
      isSignedIn: () => state.signedIn,
      onEnded: () => {
        state.signOuts += 1;
      },
      ended: async () => {
        state.checks += 1;
        if (state.hold) await new Promise((resolve) => (release = resolve));
        return state.over;
      },
      now: () => state.clock,
    });
    return { state, onRefused, release: () => release() };
  }

  it("signs out once the backend confirms the session is gone", async () => {
    const { state, onRefused } = watch();
    await onRefused();
    await onRefused();
    assert.equal(state.checks, 1);
    assert.equal(state.signOuts, 1);
  });

  it("does nothing for a visitor who is not signed in (a guarded button pressed while signed out)", async () => {
    const { state, onRefused } = watch({ signedIn: false });
    await onRefused();
    assert.equal(state.checks, 0);
    assert.equal(state.signOuts, 0);
  });

  it("asks once for a burst of refusals that arrive together", async () => {
    const { state, onRefused, release } = watch();
    state.hold = true;
    const burst = Promise.all([onRefused(), onRefused(), onRefused()]);
    release();
    await burst;
    assert.equal(state.checks, 1);
    assert.equal(state.signOuts, 1);
  });

  it("keeps the person signed in when the session is alive, and does not ask again for a while", async () => {
    const { state, onRefused } = watch({ over: false });
    await onRefused();
    await onRefused();
    assert.equal(state.checks, 1);
    assert.equal(state.signOuts, 0);

    state.clock += RECHECK_AFTER_MS;
    state.over = true;
    await onRefused();
    assert.equal(state.checks, 2);
    assert.equal(state.signOuts, 1);
  });
});

describe("sessionEndedRedirect: a server action whose session the backend refused", () => {
  const action = (referer, extra = {}) => sessionEndedRedirect({ action: true, sessionCookie: true, referer, ...extra });

  it("sends them to sign in, coming back to the page the action ran on", () => {
    assert.equal(action("https://www.remoteworldwide.net/dashboard/apply?job=abc"), "/login?next=%2Fdashboard%2Fapply%3Fjob%3Dabc&ended=1");
    assert.equal(action("https://www.remoteworldwide.net/heroshima/jobs"), "/login?next=%2Fheroshima%2Fjobs&ended=1");
  });

  it("goes home when the page cannot be told, or is not one of ours to return to", () => {
    assert.equal(action(null), "/login?ended=1");
    assert.equal(action("not a url"), "/login?ended=1");
    assert.equal(action("https://www.remoteworldwide.net//evil.example/x"), "/login?ended=1");
  });

  it("leaves a page render and a route handler alone: their 401s are handled where they land", () => {
    assert.equal(action("https://www.remoteworldwide.net/dashboard", { action: false }), null);
  });

  it("leaves a signed-out visitor alone: no session cookie, no jump to sign-in", () => {
    assert.equal(action("https://www.remoteworldwide.net/jobs/some-job", { sessionCookie: false }), null);
  });

  it("cannot loop: never from the sign-in or sign-up page", () => {
    assert.equal(action("https://www.remoteworldwide.net/login?next=%2Fdashboard&ended=1"), null);
    assert.equal(action("https://www.remoteworldwide.net/login"), null);
    assert.equal(action("https://www.remoteworldwide.net/signup?next=%2Fdashboard"), null);
  });

  it("marks sign-in so the page finishes signing out and says so", () => {
    assert.equal(loginAfterSessionEnded("/"), "/login?ended=1");
    assert.equal(loginAfterSessionEnded("/dashboard"), "/login?next=%2Fdashboard&ended=1");
  });
});

describe("the server action wiring", () => {
  const guardsSource = readFileSync(new URL("../app/lib/auth/action-guards.ts", import.meta.url), "utf8");
  const querySource = readFileSync(new URL("../libs/query.ts", import.meta.url), "utf8");
  const actionSource = readFileSync(new URL("../app/lib/auth/sessionEndedAction.ts", import.meta.url), "utf8");
  const loginSource = readFileSync(new URL("../app/(pages)/(general)/login/page.tsx", import.meta.url), "utf8");
  const noticeSource = readFileSync(new URL("../app/components/auth/SessionEndedNotice.tsx", import.meta.url), "utf8");
  const watchSource = readFileSync(new URL("../app/components/SessionWatch.tsx", import.meta.url), "utf8");

  it("redirects only on the action request itself, with the cookie and page it carried", () => {
    assert.match(actionSource, /action: incoming\.has\("next-action"\)/);
    assert.match(actionSource, /sessionCookie: sessionCookieOf\(incoming\.get\("cookie"\)\) !== null/);
    assert.match(actionSource, /referer: incoming\.get\("referer"\)/);
  });

  it("the action guard redirects on the backend's 'nobody', never on a lookup that failed", () => {
    assert.match(guardsSource, /const \{ session, failed \} = await sessionAnswer\(\);/);
    assert.match(guardsSource, /if \(!failed\) await redirectEndedSession\(\);\s*throw new ActionAuthError\("Unauthorized", 401\);/);
  });

  it("every catch in libs/query.ts that rewraps or answers an error lets the redirect through first", () => {
    for (const helper of ["boardError", "boardRefused", "surface", "opaque"]) {
      assert.match(querySource, new RegExp(`const ${helper} = \\([^)]*\\)[^=]*=> \\{\\s*unstable_rethrow\\(error\\);`), helper);
    }
    assert.match(querySource, /\} catch \(error\) \{\s*unstable_rethrow\(error\);\s*throw new Error\("something went wrong"\);/);
    // No other catch in the file swallows an unknown error without one of those helpers.
    // (?=\S) pins \s* to all of the whitespace, so the lookahead reads the first statement.
    const bare = querySource.match(/catch \(error\) \{\s*(?=\S)(?!unstable_rethrow|return (?:boardError|boardRefused|refused|opaque)\()/g) ?? [];
    assert.deepEqual(bare, []);
  });

  it("the sign-in page finishes the sign-out where it stands, after checking with the backend", () => {
    assert.match(loginSource, /params\[SESSION_ENDED_PARAM\] === "1" && <SessionEndedNotice \/>/);
    assert.match(noticeSource, /if \(await sessionEnded\(\)\) await signOut\(\{ redirect: false \}\);/);
    assert.match(noticeSource, /status !== "authenticated"/);
    assert.match(watchSource, /callbackUrl: loginAfterSessionEnded\(/);
  });
});

describe("auth.ts and the root layout", () => {
  const authSource = readFileSync(new URL("../auth.ts", import.meta.url), "utf8");
  const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const backendSource = readFileSync(new URL("../app/lib/backend.ts", import.meta.url), "utf8");
  const coreSource = readFileSync(new URL("../app/lib/api/core.ts", import.meta.url), "utf8");

  it("forgets the held answer when a backend call made with the visitor's cookie answers 401, and redirects an action", () => {
    assert.match(authSource, /export function forgetSession\(/);
    assert.match(backendSource, /if \(res\.status === 401 && h\.cookie\) \{\s*forgetSession\(h\.cookie\);\s*await redirectEndedSession\(\);\s*\}/);
  });

  it("tells the tab about every 401 a browser call gets, and the tab is listening", () => {
    assert.match(coreSource, /announceSessionRefused\(error\);/);
    assert.match(coreSource, /error\.status !== 401/);
    assert.match(layoutSource, /<SessionWatch \/>/);
    // Inside the provider: it reads whether the tab is signed in from useSession().
    assert.ok(layoutSource.indexOf("<SessionWatch />") > layoutSource.indexOf("<SessionProvider"));
    assert.ok(layoutSource.indexOf("<SessionWatch />") < layoutSource.indexOf("</SessionProvider>"));
  });

  it("asks the backend only through the held answers, and not at all without a session cookie", () => {
    assert.match(authSource, /sessionCookieOf\(cookie\)/);
    assert.match(authSource, /if \(!cookie \|\| !token\)/);
    assert.match(authSource, /lookups\.lookup\(token, \(\) => askBackend\(cookie, incoming\)\)/);
    // askBackend is defined once and called from that one place.
    assert.equal(authSource.match(/askBackend\(/g)?.length, 2);
  });

  it("does not re-ask on every tab focus", () => {
    assert.match(layoutSource, /<SessionProvider refetchOnWindowFocus=\{false\}>/);
  });
});
