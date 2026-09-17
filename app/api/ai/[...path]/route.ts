// The browser's door to the AI service.
//
// Every dashboard screen that scores, builds or drafts something calls
// `/api/ai/...` on this origin. This handler is what makes that safe:
//
//  1. It resolves the caller from the Auth.js session, server-side.
//  2. It injects the service token, which never reaches the browser.
//  3. It sets `x-user-id` from the verified session on EVERY method, strips any
//     `userId` query parameter, and overwrites `userId` in a JSON body. A client
//     is never trusted to say who it is, so reading, scoring or billing another
//     user's account is not expressible in the request. The header matters for
//     GET: a body-only identity left every read-by-id route open to whoever asked.
//  4. It sets `x-user-role` from the same session (the field the full-admin
//     layout checks), for the service's admin-only routes. Headers going
//     upstream are built here from scratch, so a role the browser sends is
//     never forwarded.
//
// A rewrite could not do any of this: rewrites cannot add headers, and they
// cannot read a session.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:4200";
const AI_TOKEN = process.env.AI_SERVICE_TOKEN ?? "";

const TIMEOUT_MS = 60_000;

/** Streamed responses pass through untouched; JSON is buffered. */
const STREAMED = new Set(["text/event-stream"]);

async function proxy(req: Request, path: string[]): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorised", message: "Sign in to continue." }, { status: 401 });
  }

  if (!AI_TOKEN) {
    return NextResponse.json(
      { success: false, error: "Not configured", message: "AI features are unavailable right now." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  // A `?userId=` from the client is dropped, not forwarded: the only identity
  // the AI service reads is the header below.
  url.searchParams.delete("userId");
  const target = `${AI_URL}/api/ai/${path.join("/")}${url.search}`;

  const headers: Record<string, string> = {
    accept: req.headers.get("accept") ?? "application/json",
    "x-service-token": AI_TOKEN,
    "x-user-id": session.user.id,
  };
  if (session.user.role) headers["x-user-role"] = session.user.role;

  // A DELETE carries no body: what it removes is in the path, and who asked is
  // the header above, so there is nothing to parse or rewrite.
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
    const raw = await req.text();
    let parsed: Record<string, unknown> = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ success: false, error: "Bad request", message: "That request wasn't valid JSON." }, { status: 400 });
      }
    }
    // The session is the only authority on identity. Whatever the client sent
    // for userId is discarded, not merged.
    parsed.userId = session.user.id;
    body = JSON.stringify(parsed);
    headers["content-type"] = "application/json";
  }

  // The timeout bounds waiting for the upstream to answer, not a stream's whole
  // life: a coach turn can run past 60 s (tool rounds, then the reply), and
  // AbortSignal.timeout would cut its body off mid-sentence with no error event.
  // Once a stream starts, the AI service's own Groq deadlines bound it, and a
  // client that goes away still cancels it through req.signal.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  req.signal.addEventListener("abort", () => controller.abort(), { once: true });

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return NextResponse.json(
      { success: false, error: "Upstream unavailable", message: "The AI service didn't respond. Try again shortly." },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";

  // A two-phase scan streams its deterministic score first and its explanation
  // after, so the body has to pass through rather than be collected.
  if (STREAMED.has(contentType.split(";")[0].trim())) {
    clearTimeout(timer);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  }

  let text: string;
  try {
    text = await upstream.text();
  } catch {
    return NextResponse.json(
      { success: false, error: "Upstream unavailable", message: "The AI service didn't respond. Try again shortly." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }

  // The service's caching rule rides along: a signed playback link is
  // `no-store`, and must not sit in a browser or edge cache past its expiry.
  const responseHeaders: Record<string, string> = { "content-type": contentType };
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) responseHeaders["cache-control"] = cacheControl;

  return new Response(text, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}

export async function POST(req: Request, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}

export async function PATCH(req: Request, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}

export async function DELETE(req: Request, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
