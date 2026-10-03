import { Suspense } from "react";
import VaultClient from "./Client";

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx, so
// this page stays a thin server component that just renders the client UI.
// Suspense because the screen reads its tab from the address (`?tab=`).
export default function VaultPage() {
  return (
    <Suspense fallback={null}>
      <VaultClient />
    </Suspense>
  );
}
