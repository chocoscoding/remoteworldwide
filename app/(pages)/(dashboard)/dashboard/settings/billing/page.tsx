import BillingClient from "./Client";

export const metadata = { title: "Plan and billing", robots: { index: false, follow: false } };

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
// `?billing=year` arrives from a plan button on /pricing with Yearly switched on.
export default async function SettingsBillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { billing, checkout, portal, session_id } = await searchParams;
  // Back from Stripe: `?checkout=success|canceled` from Checkout, `?portal=back` from the billing portal.
  const returned = checkout === "success" || checkout === "canceled" ? checkout : portal ? "portal" : undefined;
  return <BillingClient initialBilling={billing === "year" ? "year" : undefined} returned={returned} sessionId={typeof session_id === "string" ? session_id : undefined} />;
}
