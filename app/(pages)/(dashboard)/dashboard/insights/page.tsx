import InsightsClient from "./Client";

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx, so this page
// stays a thin server component that just renders the client UI.
export default function InsightsPage() {
  return <InsightsClient />;
}
