import SetupClient from "./Client";

export default async function PrepSetupPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  return <SetupClient trackId={trackId} />;
}
