import SetupClient from "./Client";

export const metadata = { title: "Set up interview prep", robots: { index: false, follow: false } };

export default async function PrepSetupPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  return <SetupClient trackId={trackId} />;
}
