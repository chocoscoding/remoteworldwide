import ProfileClient from "./Client";

export const metadata = { title: "Profile settings", robots: { index: false, follow: false } };

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
export default function SettingsProfilePage() {
  return <ProfileClient />;
}
