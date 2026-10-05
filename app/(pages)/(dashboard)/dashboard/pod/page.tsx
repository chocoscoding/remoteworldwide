import { Suspense } from "react";
import PodClient from "./Client";
import { LivePodProvider } from "@/app/components/dashboard/pod/LivePodProvider";
import PodLocked from "@/app/components/dashboard/pod/PodLocked";
import { BackendError } from "@/app/lib/api/core";
import { getPodOverview } from "@/libs/pod";

export const metadata = { title: "Your pod", robots: { index: false, follow: false } };

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
//
// The overview is fetched here rather than on the client so the first paint is
// the real screen — empty state or populated — and handed to React Query as
// `initialData`, which means no loading flash and no second request on mount.
//
// LivePodProvider is mounted here, not in the shell: it supplies the pod
// context (`PodCtx`), so `usePod()` in the pod's dialogs reads the API. Nothing
// outside this subtree reads that context.
//
// The Suspense boundary is required rather than decorative: the screen reads
// `?join=<code>` with useSearchParams, and Next refuses to prerender a page
// that does so without one.
export const dynamic = "force-dynamic";

export default async function DashboardPodPage() {
  // The pod is on Basic and up. Below it the backend refuses the overview (403
  // plan_required), an expected answer rather than an error: the screen says so.
  const overview = await getPodOverview().catch((error: unknown) => {
    if (error instanceof BackendError && error.code === "plan_required") return null;
    throw error;
  });
  if (!overview) return <PodLocked />;

  return (
    <LivePodProvider initial={overview}>
      <Suspense>
        <PodClient />
      </Suspense>
    </LivePodProvider>
  );
}
