import PrivacyClient from "./Client";

export const metadata = { title: "Privacy settings", robots: { index: false, follow: false } };

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
export default function SettingsPrivacyPage() {
  return <PrivacyClient />;
}
