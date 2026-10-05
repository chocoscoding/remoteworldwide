import AtsClient from "./Client";

export const metadata = { title: "ATS scorer", robots: { index: false, follow: false } };

export default function AtsPage() {
  return <AtsClient />;
}
