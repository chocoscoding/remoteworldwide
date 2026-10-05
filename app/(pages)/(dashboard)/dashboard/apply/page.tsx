import ApplyClient from "./Client";

export const metadata = { title: "Apply to a job", robots: { index: false, follow: false } };

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx, so
// this page stays a thin server component that just renders the client UI.
export default function ApplyPage() {
  return <ApplyClient />;
}
