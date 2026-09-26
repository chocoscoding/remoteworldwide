import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

// Its own group: none of the marketing site's Navbar/Footer, none of the
// dashboard's sidebar and providers — one task on the page. The toast host is
// the dashboard's (the upload, save and settings hooks all toast through
// sonner), mounted here because that one lives inside DashboardShell.

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-primary2 text-primary">
      {children}
      <Toaster />
    </div>
  );
}
