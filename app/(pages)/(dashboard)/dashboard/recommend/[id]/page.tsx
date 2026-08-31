import RecDetailClient from "./Client";

// Auth is gated in the dashboard layout; params are async in this Next.
export default async function RecommendationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecDetailClient entryId={id} />;
}
