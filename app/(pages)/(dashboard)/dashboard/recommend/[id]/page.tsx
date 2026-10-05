import RecDetailClient from "./Client";

export const metadata = { title: "Recommendation", robots: { index: false, follow: false } };

// Auth is gated in the dashboard layout; params are async in this Next.
export default async function RecommendationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecDetailClient entryId={id} />;
}
