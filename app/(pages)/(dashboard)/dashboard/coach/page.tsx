import CoachClient from "./Client";

export const metadata = { title: "Career coach", robots: { index: false, follow: false } };

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx, so
// this page stays a thin server component that just renders the client UI.
export default function CoachPage() {
  return <CoachClient />;
}
