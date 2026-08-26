import LiveClient from "./Client";

export default async function PrepLivePage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  return <LiveClient trackId={trackId} />;
}
