import BillingClient from "./Client";

export const metadata = { title: "Plan and billing", robots: { index: false, follow: false } };

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
// `?billing=year` arrives from a plan button on /pricing with Yearly switched on.
export default async function SettingsBillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { billing } = await searchParams;
  return <BillingClient initialBilling={billing === "year" ? "year" : undefined} />;
}
