import BillingClient from "./Client";

export const metadata = { title: "Plan and billing", robots: { index: false, follow: false } };

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
// `?plan=` (and `?billing=quarter` or `?billing=year` unless Monthly is picked) arrives from a plan button on /pricing.
export default async function SettingsBillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { billing, checkout, plan, portal, session_id } = await searchParams;
  // Back from Stripe: `?checkout=success|canceled` from Checkout, `?portal=back` from the billing portal.
  const returned = checkout === "success" || checkout === "canceled" ? checkout : portal ? "portal" : undefined;
  return (
    <BillingClient
      initialBilling={billing === "year" || billing === "quarter" ? billing : undefined}
      pickedPlan={typeof plan === "string" ? plan : undefined}
      returned={returned}
      sessionId={typeof session_id === "string" ? session_id : undefined}
    />
  );
}
