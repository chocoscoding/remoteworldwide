import { auth } from "@/auth";
import AccountClient from "./Client";

// Auth is gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
export default async function SettingsAccountPage() {
  // Read here rather than in the client: the session is already resolved server-side, and the alternative
  // is a `useSession()` round trip to render a line of text.
  const session = await auth();

  return <AccountClient verified={session?.user?.verified !== false} />;
}
