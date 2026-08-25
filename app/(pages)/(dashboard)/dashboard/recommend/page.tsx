import RecommendClient from "./Client";

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx, so
// this page stays a thin server component that just renders the client UI.
export default function DashboardRecommendPage() {
  return <RecommendClient />;
}
