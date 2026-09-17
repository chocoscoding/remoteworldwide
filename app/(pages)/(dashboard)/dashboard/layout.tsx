import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/app/components/dashboard/DashboardShell";
import { getSettings } from "@/libs/settings";
import { getBillingOverview } from "@/libs/billing";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Signed in but unproven. They keep the session — it is what makes resending a link trivial —
  // and see one screen until the address is confirmed. `/verify-email` sits outside this layout
  // deliberately, or the redirect would land back here and loop.
  if (session.user.verified === false) redirect("/verify-email");

  const [settings, billing] = await Promise.all([getSettings(), getBillingOverview()]);

  return (
    <DashboardShell settings={settings} billing={billing}>
      {children}
    </DashboardShell>
  );
}
