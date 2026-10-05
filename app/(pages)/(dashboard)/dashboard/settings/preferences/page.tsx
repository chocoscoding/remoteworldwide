import PreferencesClient from "./Client";

export const metadata = { title: "Job preferences", robots: { index: false, follow: false } };

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
export default function SettingsPreferencesPage() {
  return <PreferencesClient />;
}
