import type { Metadata } from "next";
import { auth } from "@/auth";
import { notFound } from "next/navigation";

export const metadata: Metadata = {};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (session === null || session.user?.role === "USER") {
    notFound();
  }
  if (session.user?.role === "AUTHOR") {
    metadata.title = "WRITER - Worldwide Remote";
  }

  return <>{children}</>;
}
