import { PrepProvider } from "./PrepProvider";

// Scopes PrepProvider to the /dashboard/prep/** route tree, so track/session
// state survives navigation between the index, hub, setup, live and report
// pages without being lifted to DashboardShell.
export default function PrepLayout({ children }: { children: React.ReactNode }) {
  return <PrepProvider>{children}</PrepProvider>;
}
