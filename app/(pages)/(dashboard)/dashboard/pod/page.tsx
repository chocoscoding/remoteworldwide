import { Suspense } from "react";
import PodClient from "./Client";
import { LivePodProvider } from "@/app/components/dashboard/pod/LivePodProvider";
import { getPodOverview } from "@/libs/pod";

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
//
// The overview is fetched here rather than on the client so the first paint is
// the real screen — empty state or populated — and handed to React Query as
// `initialData`, which means no loading flash and no second request on mount.
//
// LivePodProvider is mounted here, not in the shell: it supplies the same
// context PodProvider does, so `usePod()` inside this subtree reads the API
// while /dashboard/pod/demo keeps falling through to the mock.
//
// The Suspense boundary is required rather than decorative: the screen reads
// `?join=<code>` with useSearchParams, and Next refuses to prerender a page
// that does so without one.
export const dynamic = "force-dynamic";

export default async function DashboardPodPage() {
  const overview = await getPodOverview();

  return (
    <LivePodProvider initial={overview}>
      <Suspense>
        <PodClient />
      </Suspense>
    </LivePodProvider>
  );
}
