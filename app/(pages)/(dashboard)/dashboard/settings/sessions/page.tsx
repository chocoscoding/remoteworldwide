import SessionsClient from "./Client";

export const metadata = { title: "Signed-in devices", robots: { index: false, follow: false } };

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
export default function SettingsSessionsPage() {
  return <SessionsClient />;
}
