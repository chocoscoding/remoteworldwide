import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COOKIE = "rww_invite";
const MAX_AGE = 60 * 60 * 24 * 30;
const CODE = /^[a-z0-9-]{3,40}$/;

/**
 * An invite link is a redirect with a memory. The code goes down as a cookie
 * and is read back by the backend at registration, because the gap between
 * clicking someone's link and actually signing up is usually days — long
 * enough that carrying it in the URL would lose it.
 *
 * Both signups read it: the register route for email and password, and the
 * Auth.js adapter for Google and GitHub, which sees it on the provider's
 * redirect back to /api/auth/callback/* (proxied, and a top-level GET, so Lax
 * carries it). The backend expires it once the account exists, by name and
 * path "/" — change either here and the backend's helpers/inviteCookie.ts
 * has to follow.
 */
export async function GET(request: Request, props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/signup", origin), 302);

  const clean = code.trim().toLowerCase();
  if (CODE.test(clean)) {
    response.cookies.set(COOKIE, clean, { maxAge: MAX_AGE, path: "/", sameSite: "lax", httpOnly: true });
  }
  return response;
}
