import { ONBOARDING_PATH } from "@/app/lib/next-url";
import { redirectInto } from "../redirect";

// The old setup address: on to `/dashboard/onboarding` with its query and fragment. See ../redirect.ts.

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return redirectInto(request, ONBOARDING_PATH);
}
