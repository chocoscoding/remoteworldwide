import { Suspense } from "react";
import PodClient from "./Client";

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx, so
// this page stays a thin server component that just renders the client UI.
//
// The Suspense boundary is required rather than decorative: the screen reads
// `?join=<code>` with useSearchParams, and Next refuses to prerender a page
// that does so without one.
export default function DashboardPodPage() {
  return (
    <Suspense>
      <PodClient />
    </Suspense>
  );
}
