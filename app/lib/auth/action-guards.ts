// The door for server actions, which `require-admin.ts` cannot be.
//
// Every export of a "use server" module is a public endpoint: Next gives each one
// an id, the id ships in the client bundle of any page that imports it, and anyone
// holding the id can call it with any arguments — no page, no layout, no admin
// route group in between. So an action must decide for itself who may run it, from
// the session, never from an argument. `libs/query.ts` once took a `userId`
// parameter for bookmarks and edited listings with no check at all, which meant
// any visitor could read or change anyone's bookmarks and delete jobs.
//
// These throw rather than return a response: a server action has no response to
// return, and a thrown error reaches the caller as a failed call (with the message
// hidden in production), which is what a refused call should look like.

import { auth } from "@/auth";

export type ActionRole = "USER" | "ADMIN" | "AUTHOR";

export interface ActionUser {
  id: string;
  role: ActionRole;
}

export class ActionAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 423,
  ) {
    super(message);
    this.name = "ActionAuthError";
  }
}

/**
 * The signed-in user, taken from the session. Throws 401 when there is none, and 423
 * when the account is waiting out its deletion: the backend refuses a locked session
 * on every guard, staff included (middleware/auth.ts), but the actions that go
 * straight to Prisma (bookmarks, the board) never pass through it, so the lock has
 * to be read here too. Nothing a locked account may still do (see and cancel the
 * deletion) goes through these guards; that runs on the backend's AllowLocked routes.
 */
export async function requireUserAction(): Promise<ActionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) throw new ActionAuthError("Unauthorized", 401);
  if (user.deletionDueAt) throw new ActionAuthError("Account locked", 423);
  return { id: user.id, role: user.role };
}

/** The signed-in user, who must hold one of `roles`. Throws 401 or 403. */
export async function requireRoleAction(...roles: ActionRole[]): Promise<ActionUser> {
  const user = await requireUserAction();
  if (!roles.includes(user.role)) throw new ActionAuthError("Forbidden", 403);
  return user;
}

/** The board is ADMIN's — the same positive check as `requireAdmin`, for actions. */
export const requireAdminAction = (): Promise<ActionUser> => requireRoleAction("ADMIN");
