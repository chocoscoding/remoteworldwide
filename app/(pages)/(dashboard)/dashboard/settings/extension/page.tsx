import ExtensionClient from "./Client";

export const metadata = { title: "Extension settings", robots: { index: false, follow: false } };

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
export default function SettingsExtensionPage() {
  return <ExtensionClient />;
}
