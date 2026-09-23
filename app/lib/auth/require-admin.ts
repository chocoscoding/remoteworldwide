// The one door for the job-board write routes (jobs, companies, filters).
//
// These routes each carried the same line: reject when `role === "USER"`. That is a
// blocklist of one, and the roles are three — so an AUTHOR, an account that exists to
// write blog posts, could create, edit and delete jobs and companies and add or remove
// the filters the board is browsed by. The board is ADMIN's, so the check here is a
// positive one: the role must be ADMIN, and anything else is refused.
//
// The two refusals are deliberately different answers. 401 means no session was
// presented and is worth retrying after signing in. 403 means this session, whoever it
// belongs to, may not do this — signing in again will not change that. Answering 401 to
// a signed-in author told the admin UI to send them back through a login that would
// return them to the same wall.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Null when the caller may write the board; otherwise the response to return unchanged.
 *
 *     const denied = await requireAdmin();
 *     if (denied) return denied;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();

  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  return null;
}
