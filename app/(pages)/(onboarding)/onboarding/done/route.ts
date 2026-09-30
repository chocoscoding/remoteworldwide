import { ONBOARDING_DONE_PATH } from "@/app/lib/next-url";
import { redirectInto } from "../../redirect";

// The old "you're set" address: on to `/dashboard/onboarding/done` with its query. See ../../redirect.ts.

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return redirectInto(request, ONBOARDING_DONE_PATH);
}
