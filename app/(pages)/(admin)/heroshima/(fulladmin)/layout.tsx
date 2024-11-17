import type { Metadata } from "next";
import { auth } from "@/auth";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "ADMIN - Worldwide Remote",
  description: "Admin of worldwide remote jobs",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (session === null || session.user?.role !== "ADMIN") {
    notFound();
  }

  return <div className="w-full flex">{children}</div>;
}
