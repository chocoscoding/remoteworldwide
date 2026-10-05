import HubClient from "./Client";

export const metadata = { title: "Interview prep", robots: { index: false, follow: false } };

// Auth is already gated in app/(pages)/(dashboard)/dashboard/layout.tsx.
export default async function PrepTrackPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  return <HubClient trackId={trackId} />;
}
