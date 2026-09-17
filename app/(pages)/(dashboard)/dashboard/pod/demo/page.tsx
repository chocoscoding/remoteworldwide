import { Suspense } from "react";
import PodClient from "./Client";

// The mock pod, kept whole. `/dashboard/pod` is the live screen backed by the
// pod API; this route is the fully-populated walkthrough — every panel filled,
// every state reachable — which the live screen cannot show until a pod has
// people and history in it.
//
// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx, so
// this stays a thin server component.
//
// The Suspense boundary is required rather than decorative: the screen reads
// `?join=<code>` with useSearchParams, and Next refuses to prerender a page
// that does so without one.
export default function DashboardPodDemoPage() {
  return (
    <Suspense>
      <PodClient />
    </Suspense>
  );
}
