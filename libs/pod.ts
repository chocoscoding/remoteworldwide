"use server";

import { backend } from "@/app/lib/backend";
import type { PodOverview } from "@/app/lib/pod/types";

/**
 * The pod screen's first paint. Read server-side so the empty state and the
 * populated screen both arrive rendered, then handed to React Query as
 * `initialData` — no loading flash, no second fetch on mount.
 */
export const getPodOverview = async () => backend<PodOverview>("/pod/overview", { session: true });
