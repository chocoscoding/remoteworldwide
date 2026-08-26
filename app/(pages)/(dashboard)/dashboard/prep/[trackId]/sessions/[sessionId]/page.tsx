import ReportClient from "./Client";

export default async function PrepSessionReportPage({ params }: { params: Promise<{ trackId: string; sessionId: string }> }) {
  const { trackId, sessionId } = await params;
  return <ReportClient trackId={trackId} sessionId={sessionId} />;
}
