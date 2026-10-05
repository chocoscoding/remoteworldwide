import { redirect } from "next/navigation";

export const metadata = { title: "Settings", robots: { index: false, follow: false } };

// /settings has no content of its own — Profile is the landing section.
export default function SettingsIndexPage() {
  redirect("/dashboard/settings/profile");
}
