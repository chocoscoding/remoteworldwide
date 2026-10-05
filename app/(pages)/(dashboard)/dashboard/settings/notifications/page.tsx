import NotificationsClient from "./Client";

export const metadata = { title: "Notification settings", robots: { index: false, follow: false } };

export default function SettingsNotificationsPage() {
  return <NotificationsClient />;
}
