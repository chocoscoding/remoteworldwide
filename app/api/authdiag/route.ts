// TEMP DIAGNOSTIC — remove after debugging the auth-modal first-click issue.
// Receives event traces from AuthModalProvider and appends them to a log file
// outside the repo so the investigating agent can read them.
import { appendFileSync } from "node:fs";

const LOG =
  "C:/Users/ot/AppData/Local/Temp/claude/c--Users-ot-Desktop-WF-remoteworldwide/ede59b4a-211f-431b-be76-9cae5b60e8ab/scratchpad/authdiag.log";

export async function POST(request: Request) {
  try {
    const { line } = (await request.json()) as { line?: string };
    if (typeof line === "string") appendFileSync(LOG, `${line}\n`);
  } catch {
    // diagnostics must never break the app
  }
  return Response.json({ ok: true });
}
