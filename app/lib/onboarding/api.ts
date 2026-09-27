// Browser-side calls for the onboarding page's resume step.
//
// Relative paths, as everywhere in `app/lib/api/client.ts`: the session cookie
// rides along first-party and nothing here says who the user is.

import { apiPost } from "@/app/lib/api/client";
import { getIngestedResume, prepareResumeForDoc } from "@/app/lib/ats/api";
import type { ResumeContent, VaultDoc } from "@/app/lib/dashboard/types";
import { ONBOARDING_DONE_PATH } from "@/app/lib/next-url";

/**
 * The resume read's mutation key, so the page can hold its "done" navigation
 * while a read is still filling fields in (`useIsMutating`) rather than
 * leaving mid-prefill some of the time and not others.
 */
export const READ_RESUME_KEY = ["onboarding", "read-resume"] as const;

/**
 * `/dashboard/onboarding/done`, carrying `next` on when there is one. A client-side push
 * to it is a route change, which is what makes the extension (listening on the
 * site for exactly that) ask again whether setup is finished.
 */
export const doneHref = (next: string | null): string => (next ? `${ONBOARDING_DONE_PATH}?next=${encodeURIComponent(next)}` : ONBOARDING_DONE_PATH);

/** A resume built in the editor, saved into My documents as a PDF (a Word file when PDFs are off). See the route. */
export const saveBuiltResumeToVault = (id: string) => apiPost<VaultDoc>("/api/onboarding/built-resume", { id });

/**
 * What a vault resume says, parsed: `/api/ats/resume-for-doc` imports it (free,
 * deduped, answered from the document's link after the first time), then the
 * parsed content is read back. The same two calls "Edit a copy" makes
 * (`editableCopyOf`). Null when the parser found no content to read.
 */
export async function readVaultResume(documentId: string): Promise<ResumeContent | null> {
  const prepared = await prepareResumeForDoc(documentId);
  const parsed = await getIngestedResume(prepared.resumeId);
  return parsed.content;
}
