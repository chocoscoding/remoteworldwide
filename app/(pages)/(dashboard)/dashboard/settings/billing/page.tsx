import BillingClient from "./Client";

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
// `?billing=year` arrives from a plan button on /pricing with Yearly switched on.
export default async function SettingsBillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { billing } = await searchParams;
  return <BillingClient initialBilling={billing === "year" ? "year" : undefined} />;
}
