import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/app/components/dashboard/DashboardShell";
import { getSettings } from "@/libs/settings";
import { getBillingOverview } from "@/libs/billing";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [settings, billing] = await Promise.all([getSettings(), getBillingOverview()]);

  return (
    <DashboardShell settings={settings} billing={billing}>
      {children}
    </DashboardShell>
  );
}
