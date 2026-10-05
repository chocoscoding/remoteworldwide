import LiveClient from "./Client";

export const metadata = { title: "Interview practice", robots: { index: false, follow: false } };

export default async function PrepLivePage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  return <LiveClient trackId={trackId} />;
}
