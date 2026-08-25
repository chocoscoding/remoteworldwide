import HomeClient from "./Client";

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx, so
// this page stays a thin server component that just renders the client UI.
export default function DashboardHomePage() {
  return <HomeClient />;
}
