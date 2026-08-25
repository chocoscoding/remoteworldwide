import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/app/components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <DashboardShell>{children}</DashboardShell>;
}
