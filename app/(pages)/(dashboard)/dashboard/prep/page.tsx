import PrepClient from "./Client";

export const metadata = { title: "Interview prep", robots: { index: false, follow: false } };

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx, so
// this page stays a thin server component that just renders the client UI.
export default function DashboardPrepPage() {
  return <PrepClient />;
}
