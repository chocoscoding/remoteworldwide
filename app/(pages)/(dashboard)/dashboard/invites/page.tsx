import InvitesClient from "./Client";
import { getInvites } from "@/libs/invites";
import { absoluteUrl } from "@/app/lib/seo";

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
//
// The page is the paginator: the list is read straight off the URL so a page
// of it can be linked, refreshed and shared like any other.
const asPage = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export default async function InvitesPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  const { page, pageSize } = await searchParams;
  const invites = await getInvites(asPage(page, 1), asPage(pageSize, 10));

  return <InvitesClient invites={invites} inviteUrl={absoluteUrl(`/j/${invites.code}`)} />;
}
