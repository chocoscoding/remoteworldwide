import ResumeClient from "./Client";

export const metadata = { title: "Resume creator", robots: { index: false, follow: false } };

export default function DashboardResumePage() {
  return <ResumeClient />;
}
