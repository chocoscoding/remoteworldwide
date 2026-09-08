"use server";

import { backend, BackendError, type BackendInit } from "@/app/lib/backend";
import type { BillingOverview, Checkout, Subscription } from "@/app/lib/settings/types";

const api = <T>(path: string, init: BackendInit = {}) => backend<T>(`/billing${path}`, { ...init, session: true });

// `error` is a required discriminant rather than an optional key so callers
// narrow to a non-null `data` after one `if (result.error)` guard.
type Attempt<T> = { data: T; error: null } | { data: null; error: string };

async function attempt<T>(run: () => Promise<T>): Promise<Attempt<T>> {
  try {
    const data = await run();
    return { data, error: null };
  } catch (error) {
    if (error instanceof BackendError && error.status < 500) return { data: null, error: error.message };
    throw error;
  }
}

export const getBillingOverview = async () => api<BillingOverview>("/overview");

export const startPlanCheckout = async (planKey: string) => attempt(() => api<Checkout>("/checkout/plan", { method: "POST", body: { planKey } }));

export const startCreditCheckout = async (packKey: string) => attempt(() => api<Checkout>("/checkout/credits", { method: "POST", body: { packKey } }));

export const cancelSubscription = async () => attempt(() => api<Subscription>("/subscription/cancel", { method: "POST" }));
