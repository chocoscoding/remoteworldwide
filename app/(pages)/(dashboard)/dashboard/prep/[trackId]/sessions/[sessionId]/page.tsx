import ReportClient from "./Client";

export const metadata = { title: "Interview report", robots: { index: false, follow: false } };

export default async function PrepSessionReportPage({ params }: { params: Promise<{ trackId: string; sessionId: string }> }) {
  const { trackId, sessionId } = await params;
  return <ReportClient trackId={trackId} sessionId={sessionId} />;
}
